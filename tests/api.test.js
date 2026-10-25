const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../backend/app');
const { createDatabase } = require('../backend/database');

async function createTestContext() {
  const db = createDatabase(':memory:');
  const app = createApp({ db, jwtSecret: 'test-secret-that-is-long-enough' });

  const adminRegistration = await request(app).post('/api/auth/register').send({
    name: 'Morgan Admin',
    email: 'admin@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(adminRegistration.status, 201);

  const adminId = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@example.com').id;
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', adminId);
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin@example.com',
    password: 'correct-horse-battery',
  });

  const userRegistration = await request(app).post('/api/auth/register').send({
    name: 'Taylor Driver',
    email: 'taylor@example.com',
    password: 'correct-horse-battery',
  });
  const userLogin = await request(app).post('/api/auth/login').send({
    email: 'taylor@example.com',
    password: 'correct-horse-battery',
  });

  return {
    app,
    db,
    adminToken: adminLogin.body.token,
    userToken: userLogin.body.token,
    close() {
      db.close();
    },
  };
}

function withToken(token) {
  return { Authorization: `Bearer ${token}` };
}

function vehicle(overrides = {}) {
  return {
    make: 'Volvo',
    model: 'XC60',
    category: 'SUV',
    price: 42000,
    quantity: 3,
    ...overrides,
  };
}

async function addVehicle(app, token, data = vehicle()) {
  return request(app).post('/api/vehicles').set(withToken(token)).send(data);
}

test('registration stores a password hash and login issues a token', async (t) => {
  const { app, db, close } = await createTestContext();
  t.after(close);

  const stored = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('taylor@example.com');
  assert.notEqual(stored.password_hash, 'correct-horse-battery');

  const response = await request(app).post('/api/auth/login').send({
    email: 'TAYLOR@example.com',
    password: 'correct-horse-battery',
  });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.token, 'string');
  assert.equal(response.body.user.role, 'user');
});

test('logout revokes the issued bearer token', async (t) => {
  const { app, userToken, close } = await createTestContext();
  t.after(close);

  const logout = await request(app).post('/api/auth/logout').set(withToken(userToken));
  const profile = await request(app).get('/api/auth/me').set(withToken(userToken));

  assert.equal(logout.status, 204);
  assert.equal(profile.status, 401);
});

test('public catalogue exposes only listed vehicles and supports real filters', async (t) => {
  const { app, adminToken, close } = await createTestContext();
  t.after(close);
  const listed = await addVehicle(app, adminToken, vehicle({
    variant: 'B5 Plus',
    description: 'Family SUV with all-wheel drive',
    bodyType: 'SUV',
    fuelType: 'hybrid',
    transmission: 'automatic',
    seatingCapacity: 5,
    year: 2024,
  }));
  const unlisted = await addVehicle(app, adminToken, vehicle({ make: 'Hidden', status: 'unlisted' }));
  assert.equal(listed.status, 201);
  assert.equal(unlisted.status, 201);

  const publicList = await request(app)
    .get('/api/public/vehicles?keyword=all-wheel&fuelType=hybrid&minSeats=5&sortBy=year')
    .expect(200);
  const publicDetail = await request(app).get(`/api/public/vehicles/${listed.body.vehicle.id}`).expect(200);
  const hiddenDetail = await request(app).get(`/api/public/vehicles/${unlisted.body.vehicle.id}`).expect(404);

  assert.equal(publicList.body.vehicles.length, 1);
  assert.equal(publicList.body.vehicles[0].variant, 'B5 Plus');
  assert.equal(publicDetail.body.vehicle.description, 'Family SUV with all-wheel drive');
  assert.equal(hiddenDetail.status, 404);
});

test('customer inventory and purchase endpoints hide unlisted vehicles', async (t) => {
  const { app, adminToken, userToken, close } = await createTestContext();
  t.after(close);
  const listed = await addVehicle(app, adminToken, vehicle({ make: 'Visible' }));
  const hidden = await addVehicle(app, adminToken, vehicle({ make: 'Hidden', status: 'unlisted' }));

  const customerList = await request(app).get('/api/vehicles/search').set(withToken(userToken)).expect(200);
  const adminList = await request(app).get('/api/vehicles/search').set(withToken(adminToken)).expect(200);
  const customerDetail = await request(app).get(`/api/vehicles/${hidden.body.vehicle.id}`)
    .set(withToken(userToken)).expect(404);
  const hiddenPurchase = await request(app).post(`/api/vehicles/${hidden.body.vehicle.id}/purchase`)
    .set(withToken(userToken)).expect(404);
  const listedPurchase = await request(app).post(`/api/vehicles/${listed.body.vehicle.id}/purchase`)
    .set(withToken(userToken)).expect(200);
  const hiddenComparison = await request(app).post('/api/ai/car-finder/compare')
    .set(withToken(userToken))
    .send({ vehicle_ids: [listed.body.vehicle.id, hidden.body.vehicle.id] })
    .expect(404);

  assert.deepEqual(customerList.body.vehicles.map(({ make }) => make), ['Visible']);
  assert.equal(adminList.body.vehicles.length, 2);
  assert.equal(customerDetail.status, 404);
  assert.equal(hiddenPurchase.status, 404);
  assert.equal(listedPurchase.body.vehicle.quantity, 2);
  assert.equal(hiddenComparison.body.error, 'One or more selected vehicles were not found');
});

test('guest and signed-in enquiries are validated, deduplicated, and visible only to admins', async (t) => {
  const { app, db, adminToken, userToken, close } = await createTestContext();
  t.after(close);
  const createdVehicle = await addVehicle(app, adminToken);
  const submissionKey = 'cb7d8922-90ca-4caf-9588-58c91cdd225f';
  const payload = {
    submissionKey,
    customerName: 'Alex Customer',
    email: 'Alex@example.com',
    phone: '+91 98765 43210',
    subject: 'Vehicle availability',
    message: 'Please let me know if this vehicle is available for a test drive.',
    vehicleId: createdVehicle.body.vehicle.id,
  };

  const guest = await request(app).post('/api/enquiries').send(payload).expect(201);
  const duplicate = await request(app).post('/api/enquiries').send(payload).expect(409);
  const invalid = await request(app).post('/api/enquiries').send({ ...payload, submissionKey: 'bad', phone: 'nope' }).expect(400);
  const userRead = await request(app).get('/api/admin/enquiries').set(withToken(userToken)).expect(403);
  const adminList = await request(app).get('/api/admin/enquiries?search=Alex').set(withToken(adminToken)).expect(200);
  const adminDashboard = await request(app).get('/api/admin/dashboard').set(withToken(adminToken)).expect(200);

  assert.equal(guest.body.status, 'new');
  assert.equal(duplicate.body.error, 'This enquiry has already been submitted');
  assert.equal(invalid.status, 400);
  assert.equal(userRead.status, 403);
  assert.equal(adminList.body.enquiries.length, 1);
  assert.equal(adminList.body.enquiries[0].vehicle.make, 'Volvo');
  assert.equal(db.prepare('SELECT user_id FROM enquiries WHERE id = ?').get(guest.body.id).user_id, null);
  assert.equal(adminDashboard.body.enquiries.total, 1);
  assert.equal(adminDashboard.body.enquiries.pending, 1);

  const invalidStatus = await request(app).get('/api/admin/enquiries?status=unknown')
    .set(withToken(adminToken)).expect(400);
  assert.equal(invalidStatus.body.error, 'Invalid request');

  const updated = await request(app).patch(`/api/admin/enquiries/${guest.body.id}`)
    .set(withToken(adminToken)).send({ status: 'contacted' }).expect(200);
  assert.equal(updated.body.enquiry.status, 'contacted');
  const updatedDashboard = await request(app).get('/api/admin/dashboard')
    .set(withToken(adminToken)).expect(200);
  assert.equal(updatedDashboard.body.enquiries.total, 1);
  assert.equal(updatedDashboard.body.enquiries.pending, 0);

  const signedIn = await request(app).post('/api/enquiries').set(withToken(userToken)).send({
    ...payload,
    submissionKey: '857dd7a8-49de-47ba-a2f2-0fd50d19cfe9',
  }).expect(201);
  const userId = db.prepare('SELECT id FROM users WHERE email = ?').get('taylor@example.com').id;
  assert.equal(db.prepare('SELECT user_id FROM enquiries WHERE id = ?').get(signedIn.body.id).user_id, userId);
});

test('disabled accounts can no longer use an already-issued access token', async (t) => {
  const { app, db, userToken, close } = await createTestContext();
  t.after(close);
  const userId = db.prepare('SELECT id FROM users WHERE email = ?').get('taylor@example.com').id;
  db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(userId);

  const profile = await request(app).get('/api/auth/me').set(withToken(userToken)).expect(401);
  const enquiry = await request(app).post('/api/enquiries').set(withToken(userToken)).send({
    submissionKey: '24c3d7ec-f149-4c09-945d-1194e5c3a168',
    customerName: 'Taylor Driver',
    email: 'taylor@example.com',
    subject: 'Question about a vehicle',
    message: 'Please contact me about current vehicle availability.',
  }).expect(401);
  assert.equal(profile.body.error, 'Invalid or expired token');
  assert.equal(enquiry.body.error, 'Invalid or expired token');
});

test('registration rejects duplicate emails and malformed input', async (t) => {
  const { app, close } = await createTestContext();
  t.after(close);

  const duplicate = await request(app).post('/api/auth/register').send({
    name: 'Another Taylor',
    email: 'TAYLOR@example.com',
    password: 'another-valid-password',
  });
  const invalid = await request(app).post('/api/auth/register').send({
    name: 'No Email',
    email: 'not-an-email',
    password: 'short',
  });

  assert.equal(duplicate.status, 409);
  assert.equal(invalid.status, 400);
});

test('login rejects incorrect credentials and registration cannot grant administrator access', async (t) => {
  const { app, db, close } = await createTestContext();
  t.after(close);

  const incorrectPassword = await request(app).post('/api/auth/login').send({
    email: 'taylor@example.com',
    password: 'incorrect-password',
  });
  const missingAccount = await request(app).post('/api/auth/login').send({
    email: 'missing@example.com',
    password: 'incorrect-password',
  });
  const attemptedPromotion = await request(app).post('/api/auth/register').send({
    name: 'Rogue Admin',
    email: 'rogue@example.com',
    password: 'correct-horse-battery',
    role: 'admin',
  });

  assert.equal(incorrectPassword.status, 401);
  assert.equal(missingAccount.status, 401);
  assert.equal(attemptedPromotion.status, 201);
  assert.equal(
    db.prepare('SELECT role FROM users WHERE email = ?').get('rogue@example.com').role,
    'user',
  );
});

test('vehicle endpoints require a valid bearer token', async (t) => {
  const { app, close } = await createTestContext();
  t.after(close);

  assert.equal((await request(app).get('/api/vehicles')).status, 401);
  assert.equal((await request(app).get('/api/vehicles/search')).status, 401);
  assert.equal((await request(app).get('/api/vehicles').set(withToken('invalid'))).status, 401);
});

test('health endpoint exposes readiness and security headers', async (t) => {
  const { app, close } = await createTestContext();
  t.after(close);

  const response = await request(app).get('/healthz');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
  assert.match(response.headers['content-security-policy'], /default-src 'self'/);
  assert.match(response.headers['content-security-policy'], /img-src 'self' data: https:/);
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('authentication endpoints limit repeated requests', async (t) => {
  const db = createDatabase(':memory:');
  const app = createApp({
    db,
    jwtSecret: 'test-secret-that-is-long-enough',
    authRateLimit: { limit: 2, windowMs: 60_000 },
  });
  t.after(() => db.close());

  const attempt = () => request(app).post('/api/auth/login').send({
    email: 'missing@example.com',
    password: 'incorrect-password',
  });

  assert.equal((await attempt()).status, 401);
  assert.equal((await attempt()).status, 401);
  const limited = await attempt();
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, 'Too many authentication attempts');
});

test('production server rejects missing or short JWT secrets', () => {
  for (const jwtSecret of ['', 'short']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'backend', 'server.js')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: jwtSecret,
        PORT: '3001',
        DATABASE_PATH: ':memory:',
      },
      timeout: 5000,
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET must be configured with at least 32 bytes in production/);
  }
});

test('vehicle creation and impossible search ranges reject invalid input', async (t) => {
  const { app, adminToken, userToken, close } = await createTestContext();
  t.after(close);

  const invalidVehicle = await addVehicle(app, adminToken, vehicle({ price: 0, quantity: -1 }));
  const impossibleRange = await request(app)
    .get('/api/vehicles/search?minPrice=50000&maxPrice=10000')
    .set(withToken(userToken));

  assert.equal(invalidVehicle.status, 400);
  assert.equal(impossibleRange.status, 400);
});

test('admins can create, update, and delete vehicles', async (t) => {
  const { app, adminToken, userToken, close } = await createTestContext();
  t.after(close);

  const forbidden = await addVehicle(app, userToken);
  assert.equal(forbidden.status, 403);

  const created = await addVehicle(app, adminToken);
  assert.equal(created.status, 201);
  assert.equal(created.body.vehicle.make, 'Volvo');
  assert.equal(typeof created.body.vehicle.id, 'string');

  const updated = await request(app).put(`/api/vehicles/${created.body.vehicle.id}`)
    .set(withToken(adminToken)).send(vehicle({ model: 'XC90', price: 51000, quantity: 4 }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.vehicle.model, 'XC90');

  const deleted = await request(app).delete(`/api/vehicles/${created.body.vehicle.id}`).set(withToken(adminToken));
  assert.equal(deleted.status, 204);
});

test('administrators can save optional vehicle specifications and leave unknown values null', async (t) => {
  const { app, adminToken, close } = await createTestContext();
  t.after(close);

  const created = await addVehicle(app, adminToken, vehicle({
    bodyType: 'Compact SUV',
    year: 2024,
    fuelType: 'hybrid',
    transmission: 'automatic',
    seatingCapacity: 5,
    mileageKmpl: 18.5,
    electricRangeKm: null,
    engineCapacityCc: 1998,
    groundClearanceMm: 210,
    safetyFeatures: 'Six airbags, ABS',
  }));

  assert.equal(created.status, 201);
  assert.equal(created.body.vehicle.bodyType, 'Compact SUV');
  assert.equal(created.body.vehicle.year, 2024);
  assert.equal(created.body.vehicle.fuelType, 'hybrid');
  assert.equal(created.body.vehicle.mileageKmpl, 18.5);
  assert.equal(created.body.vehicle.electricRangeKm, null);
  assert.equal(created.body.vehicle.safetyFeatures, 'Six airbags, ABS');

  const updated = await request(app).put(`/api/vehicles/${created.body.vehicle.id}`)
    .set(withToken(adminToken))
    .send(vehicle({ fuelType: 'diesel', seatingCapacity: 7 }));

  assert.equal(updated.status, 200);
  assert.equal(updated.body.vehicle.fuelType, 'diesel');
  assert.equal(updated.body.vehicle.seatingCapacity, 7);
  assert.equal(updated.body.vehicle.bodyType, null);
});

test('users can list and filter vehicles by text, category, and price', async (t) => {
  const { app, adminToken, userToken, close } = await createTestContext();
  t.after(close);

  await addVehicle(app, adminToken);
  await addVehicle(app, adminToken, vehicle({ make: 'Toyota', model: 'RAV4', category: 'SUV', price: 35000 }));
  await addVehicle(app, adminToken, vehicle({ make: 'Volvo', model: 'S60', category: 'Sedan', price: 39000 }));

  const all = await request(app).get('/api/vehicles').set(withToken(userToken));
  const filtered = await request(app).get('/api/vehicles/search?make=volvo&category=SUV&minPrice=40000&maxPrice=45000')
    .set(withToken(userToken));

  assert.equal(all.status, 200);
  assert.equal(all.body.vehicles.length, 3);
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.vehicles.length, 1);
  assert.equal(filtered.body.vehicles[0].model, 'XC60');
});

test('vehicle listing supports validated sorting and pagination', async (t) => {
  const { app, adminToken, userToken, close } = await createTestContext();
  t.after(close);

  await addVehicle(app, adminToken, vehicle({ model: 'XC90', price: 51000 }));
  await addVehicle(app, adminToken, vehicle({ make: 'Toyota', model: 'RAV4', price: 35000 }));
  await addVehicle(app, adminToken, vehicle({ make: 'Honda', model: 'CR-V', price: 39000 }));

  const firstPage = await request(app)
    .get('/api/vehicles?page=1&pageSize=2&sortBy=price&sortOrder=asc')
    .set(withToken(userToken));
  const secondPage = await request(app)
    .get('/api/vehicles?page=2&pageSize=2&sortBy=price&sortOrder=asc')
    .set(withToken(userToken));
  const invalidPage = await request(app)
    .get('/api/vehicles?pageSize=101')
    .set(withToken(userToken));

  assert.equal(firstPage.status, 200);
  assert.deepEqual(firstPage.body.vehicles.map((item) => item.price), [35000, 39000]);
  assert.deepEqual(firstPage.body.pagination, { page: 1, pageSize: 2, total: 3, totalPages: 2 });
  assert.deepEqual(secondPage.body.vehicles.map((item) => item.price), [51000]);
  assert.equal(invalidPage.status, 400);
});

test('purchasing decrements available quantity and prevents overselling', async (t) => {
  const { app, adminToken, userToken, close } = await createTestContext();
  t.after(close);

  const created = await addVehicle(app, adminToken, vehicle({ quantity: 1 }));
  const url = `/api/vehicles/${created.body.vehicle.id}/purchase`;

  const purchased = await request(app).post(url).set(withToken(userToken)).send();
  const soldOut = await request(app).post(url).set(withToken(userToken)).send();

  assert.equal(purchased.status, 200);
  assert.equal(purchased.body.vehicle.quantity, 0);
  assert.equal(soldOut.status, 409);
});

test('only admins can restock vehicles and invalid quantities are rejected', async (t) => {
  const { app, adminToken, userToken, close } = await createTestContext();
  t.after(close);

  const created = await addVehicle(app, adminToken, vehicle({ quantity: 2 }));
  const url = `/api/vehicles/${created.body.vehicle.id}/restock`;

  const forbidden = await request(app).post(url).set(withToken(userToken)).send({ quantity: 1 });
  const invalid = await request(app).post(url).set(withToken(adminToken)).send({ quantity: -4 });
  const restocked = await request(app).post(url).set(withToken(adminToken)).send({ quantity: 3 });

  assert.equal(forbidden.status, 403);
  assert.equal(invalid.status, 400);
  assert.equal(restocked.status, 200);
  assert.equal(restocked.body.vehicle.quantity, 5);
});

test('vehicle inventory persists in a file-backed SQLite database', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dealership-db-'));
  const filename = path.join(directory, 'inventory.sqlite');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const firstConnection = createDatabase(filename);
  firstConnection.prepare(`
    INSERT INTO vehicles (id, make, model, category, price, quantity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('persistent-test-id', 'Volvo', 'XC60', 'SUV', 42000, 3);
  firstConnection.close();

  const secondConnection = createDatabase(filename);
  const saved = secondConnection.prepare('SELECT make, model, quantity FROM vehicles WHERE id = ?')
    .get('persistent-test-id');
  secondConnection.close();

  assert.deepEqual({ ...saved }, { make: 'Volvo', model: 'XC60', quantity: 3 });
});

test('database schema changes are tracked and applied as migrations', (t) => {
  const db = createDatabase(':memory:');
  t.after(() => db.close());

  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 5);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'purchases'").get().name, 'purchases');
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'enquiries'").get().name, 'enquiries');
});

test('migrations upgrade an existing database without losing its inventory', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dealership-upgrade-'));
  const filename = path.join(directory, 'legacy.sqlite');
  let upgraded;
  t.after(() => {
    if (upgraded) upgraded.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const legacy = new DatabaseSync(filename);
  legacy.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE vehicles (
      id TEXT PRIMARY KEY, make TEXT NOT NULL, model TEXT NOT NULL, category TEXT NOT NULL,
      price REAL NOT NULL, quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO users (id, name, email, password_hash)
    VALUES ('legacy-user', 'Legacy User', 'legacy@example.com', 'legacy-hash');
    INSERT INTO vehicles (id, make, model, category, price, quantity)
    VALUES ('legacy-vehicle', 'Volvo', 'XC60', 'SUV', 42000, 3);
  `);
  legacy.close();

  upgraded = createDatabase(filename);
  const saved = upgraded.prepare('SELECT make, quantity, price FROM vehicles WHERE id = ?').get('legacy-vehicle');

  assert.equal(upgraded.prepare('PRAGMA user_version').get().user_version, 5);
  assert.deepEqual({ ...saved }, { make: 'Volvo', quantity: 3, price: 3990061.66 });
  assert.equal(upgraded.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'purchases'").get().name, 'purchases');
  assert.equal(upgraded.prepare("SELECT status FROM users WHERE id = 'legacy-user'").get().status, 'active');
  assert.equal(upgraded.prepare("SELECT status FROM vehicles WHERE id = 'legacy-vehicle'").get().status, 'listed');
});

test('currency migration converts inventory and purchase snapshots using the recorded USD/INR rate', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dealership-currency-'));
  const filename = path.join(directory, 'currency.sqlite');
  let upgraded;
  t.after(() => {
    if (upgraded) upgraded.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const beforeConversion = new DatabaseSync(filename);
  beforeConversion.exec('PRAGMA foreign_keys = ON');
  for (const migration of [
    '001_initial_schema.sql',
    '002_purchase_records.sql',
    '003_vehicle_specifications.sql',
  ]) {
    beforeConversion.exec(fs.readFileSync(path.join(__dirname, '..', 'backend', 'migrations', migration), 'utf8'));
  }
  beforeConversion.exec('PRAGMA user_version = 3');
  beforeConversion.prepare(`
    INSERT INTO users (id, name, email, password_hash)
    VALUES ('currency-user', 'Currency User', 'currency@example.com', 'hash')
  `).run();
  beforeConversion.prepare(`
    INSERT INTO vehicles (id, make, model, category, price, quantity)
    VALUES ('currency-vehicle', 'Volvo', 'XC60', 'SUV', 42000, 1)
  `).run();
  beforeConversion.prepare(`
    INSERT INTO purchases (id, vehicle_id, user_id, quantity, unit_price, total_amount)
    VALUES ('currency-purchase', 'currency-vehicle', 'currency-user', 2, 42000, 84000)
  `).run();
  beforeConversion.close();

  upgraded = createDatabase(filename);
  const convertedVehicle = upgraded.prepare('SELECT price FROM vehicles WHERE id = ?').get('currency-vehicle');
  const convertedPurchase = upgraded.prepare('SELECT unit_price, total_amount FROM purchases WHERE id = ?')
    .get('currency-purchase');

  assert.equal(convertedVehicle.price, 3990061.66);
  assert.deepEqual({ ...convertedPurchase }, { unit_price: 3990061.66, total_amount: 7980123.31 });
});

test('authenticated users can retrieve their public account profile', async (t) => {
  const { app, userToken, close } = await createTestContext();
  t.after(close);

  const response = await request(app).get('/api/auth/me').set(withToken(userToken));

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.user, {
    id: response.body.user.id,
    name: 'Taylor Driver',
    email: 'taylor@example.com',
    role: 'user',
  });
  assert.equal('password_hash' in response.body.user, false);
});

test('a purchase creates an immutable price snapshot and prevents deleting its vehicle', async (t) => {
  const { app, db, adminToken, userToken, close } = await createTestContext();
  t.after(close);

  const created = await addVehicle(app, adminToken, vehicle({ price: 42000, quantity: 1 }));
  const purchaseResponse = await request(app)
    .post(`/api/vehicles/${created.body.vehicle.id}/purchase`)
    .set(withToken(userToken));

  assert.equal(purchaseResponse.status, 200);
  assert.equal(purchaseResponse.body.purchase.unitPrice, 42000);
  assert.equal(purchaseResponse.body.purchase.totalAmount, 42000);
  assert.equal(purchaseResponse.body.purchase.quantity, 1);

  await request(app).put(`/api/vehicles/${created.body.vehicle.id}`)
    .set(withToken(adminToken)).send(vehicle({ price: 48000, quantity: 2 }));
  const purchase = db.prepare('SELECT unit_price, total_amount, quantity FROM purchases WHERE vehicle_id = ?')
    .get(created.body.vehicle.id);
  assert.deepEqual({ ...purchase }, { unit_price: 42000, total_amount: 42000, quantity: 1 });

  const deleted = await request(app).delete(`/api/vehicles/${created.body.vehicle.id}`)
    .set(withToken(adminToken));
  assert.equal(deleted.status, 409);
});

test('failed and concurrent purchases do not oversell or create extra purchase records', async (t) => {
  const { app, db, adminToken, userToken, close } = await createTestContext();
  t.after(close);

  const created = await addVehicle(app, adminToken, vehicle({ quantity: 1 }));
  const url = `/api/vehicles/${created.body.vehicle.id}/purchase`;
  const responses = await Promise.all([
    request(app).post(url).set(withToken(userToken)),
    request(app).post(url).set(withToken(userToken)),
  ]);

  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(db.prepare('SELECT quantity FROM vehicles WHERE id = ?').get(created.body.vehicle.id).quantity, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM purchases WHERE vehicle_id = ?')
    .get(created.body.vehicle.id).count, 1);
});

test('purchase transaction rolls back inventory when writing its audit record fails', async (t) => {
  const { app, db, adminToken, userToken, close } = await createTestContext();
  t.after(close);

  const created = await addVehicle(app, adminToken, vehicle({ quantity: 1 }));
  db.exec(`
    CREATE TRIGGER reject_purchase_record
    BEFORE INSERT ON purchases
    BEGIN
      SELECT RAISE(ABORT, 'simulated purchase record failure');
    END;
  `);

  const response = await request(app)
    .post(`/api/vehicles/${created.body.vehicle.id}/purchase`)
    .set(withToken(userToken));

  assert.equal(response.status, 500);
  assert.equal(db.prepare('SELECT quantity FROM vehicles WHERE id = ?').get(created.body.vehicle.id).quantity, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM purchases').get().count, 0);
});
