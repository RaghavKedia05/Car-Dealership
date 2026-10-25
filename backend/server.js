const path = require('node:path');
const { createApp } = require('./app');
const { createDatabase } = require('./database');

const port = Number.parseInt(process.env.PORT || '3001', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

if (process.env.NODE_ENV === 'production'
  && (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32)) {
  throw new Error('JWT_SECRET must be configured with at least 32 bytes in production');
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
}

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'dealership.db');
const db = createDatabase(databasePath);
const app = createApp({ db, jwtSecret: process.env.JWT_SECRET });
if (process.env.TRUST_PROXY_HOPS !== undefined && process.env.TRUST_PROXY_HOPS !== '0') {
  if (!/^\d+$/.test(process.env.TRUST_PROXY_HOPS)) {
    throw new Error('TRUST_PROXY_HOPS must be 0 or an integer between 1 and 10');
  }
  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS, 10);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1 || trustProxyHops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be 0 or an integer between 1 and 10');
  }
  app.set('trust proxy', trustProxyHops);
}
const server = app.listen(port, () => {
  console.log(`Dealership API listening on port ${port}`);
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
