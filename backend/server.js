const { createApp } = require('./app');
const { createPostgresDatabase } = require('./database/postgres-database');
const { seedAdmin } = require('./seed-admin');
const { expireCheckoutOrders } = require('./services/order-reservations');

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

const db = createPostgresDatabase();
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
let server;
let checkoutCleanupTimer;

function shutdown() {
  if (checkoutCleanupTimer) clearInterval(checkoutCleanupTimer);
  const closeDatabase = () => db.close();
  if (!server) {
    closeDatabase();
    return;
  }
  server.close((error) => {
    Promise.resolve(closeDatabase()).catch((closeError) => {
      console.error(closeError);
      process.exitCode = 1;
    });
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

async function start() {
  await db.migrate();
  await expireCheckoutOrders(db);
  if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
    console.log(await seedAdmin(db));
  }
  checkoutCleanupTimer = setInterval(() => {
    expireCheckoutOrders(db).catch((error) => console.error('Could not expire old checkouts:', error));
  }, 60_000);
  checkoutCleanupTimer.unref();
  const app = createApp({ db, jwtSecret: process.env.JWT_SECRET, corsOrigins });
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
  server = app.listen(port, () => {
    console.log(`Dealership API listening on port ${port}`);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
start().catch(async (error) => {
  console.error(error);
  await db.close();
  process.exitCode = 1;
});
