const path = require('node:path');
const fs = require('node:fs');
const { createDatabase, createPostgresDatabase } = require('../backend/database');

const tables = ['users', 'vehicles', 'purchases', 'enquiries', 'revoked_tokens'];

async function migrateData() {
  const sourcePath = process.env.SQLITE_SOURCE_PATH
    || path.join(__dirname, '..', 'data', 'dealership.db');
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`SQLite source database does not exist: ${sourcePath}`);
  }
  const source = createDatabase(sourcePath);
  let target;

  try {
    target = createPostgresDatabase();
    await target.migrate();
    const targetCounts = await Promise.all(tables.map(async (table) => {
      const row = await target.get(`SELECT COUNT(*) AS count FROM ${table}`);
      return Number(row.count);
    }));
    if (targetCounts.some((count) => count > 0)) {
      throw new Error('PostgreSQL target tables are not empty; refusing to merge or overwrite data');
    }

    const counts = {};
    await target.transaction(async (transaction) => {
      for (const table of tables) {
        const rows = source.prepare(`SELECT * FROM ${table}`).all();
        counts[table] = rows.length;
        for (const row of rows) {
          const columns = Object.keys(row);
          const columnList = columns.map((column) => `"${column}"`).join(', ');
          const placeholders = columns.map(() => '?').join(', ');
          await transaction.run(
            `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`,
            ...columns.map((column) => row[column]),
          );
        }
      }
    });
    console.log(`Copied SQLite data to PostgreSQL: ${JSON.stringify(counts)}`);
  } finally {
    source.close();
    if (target) await target.close();
  }
}

migrateData().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
