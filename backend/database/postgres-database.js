const fs = require('node:fs');
const path = require('node:path');

const postgresMigration = path.join(__dirname, 'postgres-schema.sql');
const postgresCheckoutMigration = path.join(__dirname, 'migrations', 'postgres', '002_checkout_orders.sql');
const postgresAccountMigration = path.join(__dirname, 'migrations', 'postgres', '003_customer_accounts.sql');
const postgresPurchaseLinkMigration = path.join(__dirname, 'migrations', 'postgres', '004_purchase_checkout_link.sql');
const postgresRegistrationMigration = path.join(__dirname, 'migrations', 'postgres', '005_registration_verifications.sql');
const postgresOfflinePaymentMigration = path.join(__dirname, 'migrations', 'postgres', '006_offline_payment_method.sql');
function postgresPlaceholders(sql) {
  let parameter = 0;
  return sql.replace(/\?/g, () => `$${++parameter}`);
}

function createPostgresDatabase({ connectionString = process.env.DATABASE_URL, pool: suppliedPool } = {}) {
  if (!connectionString && !suppliedPool) {
    throw new Error('DATABASE_URL must be configured for PostgreSQL');
  }

  const Pool = require('pg').Pool;
  const poolSize = Number(process.env.DATABASE_POOL_MAX || '5');
  if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 50) {
    throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 50');
  }
  const pool = suppliedPool || new Pool({
    connectionString,
    max: poolSize,
  });

  const databaseFor = (client) => ({
    async get(sql, ...values) {
      const result = await client.query(postgresPlaceholders(sql), values);
      return result.rows[0];
    },
    async all(sql, ...values) {
      const result = await client.query(postgresPlaceholders(sql), values);
      return result.rows;
    },
    async run(sql, ...values) {
      const result = await client.query(postgresPlaceholders(sql), values);
      return { changes: result.rowCount };
    },
  });

  const db = {
    ...databaseFor(pool),
    async transaction(callback) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(databaseFor(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
    async migrate() {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(732107312041)');
        await client.query(`
          CREATE TABLE IF NOT EXISTS app_schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        const { rows } = await client.query('SELECT MAX(version) AS version FROM app_schema_migrations');
        let currentVersion = Number(rows[0].version || 0);
        if (currentVersion > 6) {
          throw new Error('PostgreSQL schema version is newer than this application supports');
        }
        if (currentVersion === 0) {
          await client.query(fs.readFileSync(postgresMigration, 'utf8'));
          await client.query('INSERT INTO app_schema_migrations (version) VALUES (1)');
          currentVersion = 1;
        }
        if (currentVersion < 2) {
          await client.query(fs.readFileSync(postgresCheckoutMigration, 'utf8'));
          await client.query('INSERT INTO app_schema_migrations (version) VALUES (2)');
        }
        if (currentVersion < 3) {
          await client.query(fs.readFileSync(postgresAccountMigration, 'utf8'));
          await client.query('INSERT INTO app_schema_migrations (version) VALUES (3)');
        }
        if (currentVersion < 4) {
          await client.query(fs.readFileSync(postgresPurchaseLinkMigration, 'utf8'));
          await client.query('INSERT INTO app_schema_migrations (version) VALUES (4)');
        }
        if (currentVersion < 5) {
          await client.query(fs.readFileSync(postgresRegistrationMigration, 'utf8'));
          await client.query('INSERT INTO app_schema_migrations (version) VALUES (5)');
        }
        if (currentVersion < 6) {
          await client.query(fs.readFileSync(postgresOfflinePaymentMigration, 'utf8'));
          await client.query('INSERT INTO app_schema_migrations (version) VALUES (6)');
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return db;
    },
  };
  return db;
}

module.exports = { createPostgresDatabase };
