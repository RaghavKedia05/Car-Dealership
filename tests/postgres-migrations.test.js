const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { createTestDatabase } = require('./helpers/postgres');

test('server requires DATABASE_URL instead of creating a local database', () => {
  const result = spawnSync(process.execPath, ['backend/server.js'], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', JWT_SECRET: 'test-secret' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DATABASE_URL must be configured/);
});

test('PostgreSQL migrations initialize every table and are idempotent', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  await db.migrate();
  const versions = await db.all('SELECT version FROM app_schema_migrations ORDER BY version');
  assert.deepEqual(versions.map(({ version }) => version), [1, 2, 3, 4, 5, 6]);
  for (const table of ['users', 'vehicles', 'purchases', 'enquiries', 'checkout_orders', 'revoked_tokens', 'registration_verifications', 'password_reset_tokens']) {
    assert.equal(Number((await db.get(`SELECT COUNT(*) AS count FROM ${table}`)).count), 0);
  }
});

test('existing PostgreSQL databases upgrade without losing inventory', async (t) => {
  const db = await createTestDatabase({ migrate: false });
  t.after(() => db.close());
  await db.run(fs.readFileSync(path.join(__dirname, '../backend/database/postgres-schema.sql'), 'utf8'));
  await db.run('ALTER TABLE checkout_orders DROP COLUMN payment_method');
  await db.run('CREATE TABLE app_schema_migrations (version INTEGER PRIMARY KEY)');
  await db.run('INSERT INTO app_schema_migrations VALUES (1)');
  await db.run("INSERT INTO vehicles (id, make, model, category, price, quantity) VALUES ('existing', 'Volvo', 'XC60', 'SUV', 42000, 3)");
  await db.migrate();
  assert.equal((await db.get("SELECT quantity FROM vehicles WHERE id = 'existing'")).quantity, 3);
  assert.equal((await db.get('SELECT MAX(version) AS version FROM app_schema_migrations')).version, 6);
  const column = await db.get("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'checkout_orders' AND column_name = 'payment_method'");
  assert.equal(column.column_name, 'payment_method');
});

test('future schema versions are rejected without changing data', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  await db.run('INSERT INTO app_schema_migrations (version) VALUES (99)');
  await assert.rejects(db.migrate(), /newer than this application supports/);
  assert.equal((await db.get('SELECT MAX(version) AS version FROM app_schema_migrations')).version, 99);
});

test('a failed PostgreSQL transaction rolls back all writes', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  await assert.rejects(db.transaction(async (tx) => {
    await tx.run("INSERT INTO vehicles (id, make, model, category, price, quantity) VALUES ('rollback', 'Volvo', 'XC60', 'SUV', 42000, 1)");
    await tx.run("UPDATE vehicles SET quantity = -1 WHERE id = 'rollback'");
  }));
  assert.equal(Number((await db.get('SELECT COUNT(*) AS count FROM vehicles')).count), 0);
});
