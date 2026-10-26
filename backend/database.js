const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const migrationDirectory = path.join(__dirname, 'migrations');
const postgresMigration = path.join(__dirname, 'postgres-schema.sql');
const migrations = [
  '001_initial_schema.sql',
  '002_purchase_records.sql',
  '003_vehicle_specifications.sql',
  '004_convert_usd_prices_to_inr.sql',
  '005_public_catalog_enquiries.sql',
];

function migrate(db) {
  const currentVersion = db.prepare('PRAGMA user_version').get().user_version;
  if (currentVersion > migrations.length) {
    throw new Error(`Database schema version ${currentVersion} is newer than this application supports`);
  }

  for (let index = currentVersion; index < migrations.length; index += 1) {
    const version = index + 1;
    const sql = fs.readFileSync(path.join(migrationDirectory, migrations[index]), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

function createDatabase(filename = path.join(__dirname, '..', 'data', 'dealership.db')) {
  if (filename !== ':memory:' && !filename.startsWith('file:')) {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    migrate(db);
    db.get = async (sql, ...values) => db.prepare(sql).get(...values);
    db.all = async (sql, ...values) => db.prepare(sql).all(...values);
    db.run = async (sql, ...values) => db.prepare(sql).run(...values);
    db.transaction = async (callback) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = await callback(db);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    };
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

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
        if (Number(rows[0].version || 0) > 1) {
          throw new Error('PostgreSQL schema version is newer than this application supports');
        }
        if (!rows[0].version) {
          await client.query(fs.readFileSync(postgresMigration, 'utf8'));
          await client.query('INSERT INTO app_schema_migrations (version) VALUES (1)');
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

module.exports = { createDatabase, createPostgresDatabase };
