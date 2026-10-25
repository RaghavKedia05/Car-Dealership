const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const migrationDirectory = path.join(__dirname, 'migrations');
const migrations = [
  '001_initial_schema.sql',
  '002_purchase_records.sql',
  '003_vehicle_specifications.sql',
  '004_convert_usd_prices_to_inr.sql',
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
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

module.exports = { createDatabase };
