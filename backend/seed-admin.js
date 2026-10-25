const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { createDatabase } = require('./database');

const adminSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'password must be no longer than 72 UTF-8 bytes',
  ),
  name: z.string().trim().min(2).max(80),
});

async function main() {
  const input = adminSchema.safeParse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME || 'Dealership Admin',
  });
  if (!input.success) {
    const fields = input.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`).join('; ');
    throw new Error(`Invalid administrator configuration: ${fields}`);
  }

  const { email, password, name } = input.data;
  const db = createDatabase(process.env.DATABASE_PATH);
  try {
    const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
    if (existing) {
      if (existing.role !== 'admin') {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', existing.id);
      }
      console.log(`Administrator access enabled for ${email}`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), name, email, passwordHash, 'admin');
    console.log(`Administrator account created for ${email}`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
