const path = require('node:path');
const { createApp } = require('./app');
const { createDatabase } = require('./database');

const port = Number.parseInt(process.env.PORT || '3001', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production');
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
}

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'dealership.db');
const db = createDatabase(databasePath);
const app = createApp({ db, jwtSecret: process.env.JWT_SECRET });
const server = app.listen(port, () => {
  console.log(`Dealership API listening on http://localhost:${port}`);
});

function shutdown() {
  server.close((error) => {
    db.close();
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
