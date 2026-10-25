const assert = require('node:assert/strict');
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

test('vehicle endpoints require a valid bearer token', async (t) => {
  const { app, close } = await createTestContext();
  t.after(close);

  assert.equal((await request(app).get('/api/vehicles')).status, 401);
  assert.equal((await request(app).get('/api/vehicles/search')).status, 401);
  assert.equal((await request(app).get('/api/vehicles').set(withToken('invalid'))).status, 401);
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
