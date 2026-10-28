const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { createDatabase, createPostgresDatabase } = require('./database/database-adapters');

const adminSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'password must be no longer than 72 UTF-8 bytes',
  ),
  name: z.string().trim().min(2).max(80),
});

async function seedAdmin(db, credentials = process.env) {
  const input = adminSchema.safeParse({
    email: credentials.ADMIN_EMAIL,
    password: credentials.ADMIN_PASSWORD,
    name: credentials.ADMIN_NAME || 'Dealership Admin',
  });
  if (!input.success) {
    const fields = input.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`).join('; ');
    throw new Error(`Invalid administrator configuration: ${fields}`);
  }

  const { email, password, name } = input.data;
  const existing = await db.get('SELECT id, role FROM users WHERE LOWER(email) = LOWER(?)', email);
  if (existing) {
    if (existing.role !== 'admin') {
      await db.run('UPDATE users SET role = ? WHERE id = ?', 'admin', existing.id);
    }
    return `Administrator access enabled for ${email}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.run(`
    INSERT INTO users (id, name, email, password_hash, role, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, randomUUID(), name, email, passwordHash, 'admin');
  return `Administrator account created for ${email}`;
}

async function main() {
  let db;
  try {
    db = process.env.DATABASE_URL
      ? createPostgresDatabase()
      : createDatabase(process.env.DATABASE_PATH);
    if (process.env.DATABASE_URL) await db.migrate();
    console.log(await seedAdmin(db));
  } finally {
    if (db) await db.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { seedAdmin };
