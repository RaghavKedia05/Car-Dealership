const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const request = require('supertest');
const { createPostgresDatabase } = require('../../backend/database/postgres-database');
const { createApp } = require('../../backend/app');

// PGlite is PostgreSQL, running in-process. Serialize access to its single connection,
// including complete transactions, to model a pool with one checked-out connection.
async function createTestDatabase({ dataDir, migrate = true } = {}) {
  if (process.env.TEST_DATABASE_URL && !dataDir) {
    const { Pool } = require('pg');
    const schema = `test_${require('node:crypto').randomBytes(12).toString('hex')}`;
    const control = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
    await control.query(`CREATE SCHEMA "${schema}"`);
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}`, max: 5 });
    const db = createPostgresDatabase({ pool });
    const closePool = db.close;
    db.close = async () => {
      await closePool();
      try { await control.query(`DROP SCHEMA "${schema}" CASCADE`); } finally { await control.end(); }
    };
    try {
      if (migrate) await db.migrate();
      return db;
    } catch (error) {
      await db.close();
      throw error;
    }
  }
  const engine = new PGlite(dataDir);
  let tail = Promise.resolve();
  async function acquire() {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    return release;
  }
  async function query(sql, values = []) {
    if (!values.length && sql.includes(';')) {
      await engine.exec(sql);
      return { rows: [], rowCount: 0 };
    }
    return engine.query(sql, values);
  }
  const pool = {
    async query(sql, values) {
      const release = await acquire();
      try { return await query(sql, values); } finally { release(); }
    },
    async connect() {
      const release = await acquire();
      return { query, release };
    },
    end: () => engine.close(),
  };
  const db = createPostgresDatabase({ pool });
  try {
    if (migrate) await db.migrate();
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

const mailboxes = new WeakMap();
function createTestApp(options) {
  const codes = new Map();
  const app = createApp({
    ...options,
    registrationEmailSender: async (email, code) => { codes.set(email, code); },
  });
  mailboxes.set(app, codes);
  return app;
}

async function registerAccount(app, input, expectedStatus) {
  let response = await request(app).post('/api/auth/register').send(input);
  if (response.status === 202) {
    const email = input.email.trim().toLowerCase();
    response = await request(app).post('/api/auth/register/verify').send({
      email, code: mailboxes.get(app).get(email),
    });
  }
  if (expectedStatus) assert.equal(response.status, expectedStatus);
  return response;
}

module.exports = { createTestDatabase, createTestApp, registerAccount };
