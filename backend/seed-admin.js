const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { createDatabase } = require('./database');

async function main() {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name = 'Dealership Admin' } = process.env;
  if (!email || !password || Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD that is 12–72 UTF-8 bytes long');
  }

  const db = createDatabase(process.env.DATABASE_PATH);
  try {
    const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      if (existing.role !== 'admin') {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', existing.id);
      }
      console.log(`Administrator access enabled for ${email}`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), name.trim(), email.trim().toLowerCase(), passwordHash, 'admin');
    console.log(`Administrator account created for ${email}`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
