const { createPostgresDatabase } = require('../backend/database/postgres-database');

async function main() {
  const db = createPostgresDatabase();
  try {
    await db.migrate();
    const { version } = await db.get('SELECT MAX(version) AS version FROM app_schema_migrations');
    console.log(`PostgreSQL schema is up to date (version ${version}).`);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
