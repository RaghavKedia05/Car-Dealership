const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { PGlite } = require('@electric-sql/pglite');
const { createApp } = require('../backend/app');
const { createPostgresDatabase } = require('../backend/database');

async function createPostgresContext() {
  const engine = new PGlite();
  const runQuery = async (sql, values) => {
    if (!values.length && sql.includes(';')) {
      await engine.exec(sql);
      return { rows: [], rowCount: 0 };
    }
    return engine.query(sql, values);
  };
  const pool = {
    query: (sql, values = []) => runQuery(sql, values),
    async connect() {
      return {
        query: (sql, values = []) => runQuery(sql, values),
        release() {},
      };
    },
    end: () => engine.close(),
  };
  const db = await createPostgresDatabase({ pool }).migrate();
  const app = createApp({ db, jwtSecret: 'test-secret-that-is-long-enough' });
  return { app, db, close: () => db.close() };
}

function withToken(token) {
  return { Authorization: `Bearer ${token}` };
}

test('PostgreSQL migrations and core dealership API routes work', async (t) => {
  const { app, db, close } = await createPostgresContext();
  t.after(close);

  await db.migrate();
  assert.equal(Number((await db.get('SELECT version FROM app_schema_migrations')).version), 1);
  assert.equal((await request(app).get('/healthz')).status, 200);

  const adminRegistration = await request(app).post('/api/auth/register').send({
    name: 'Morgan Admin',
    email: 'ADMIN@example.com',
    password: 'correct-horse-battery',
  }).expect(201);
  const adminId = adminRegistration.body.user.id;
  await db.run('UPDATE users SET role = ? WHERE id = ?', 'admin', adminId);
  await db.run('UPDATE users SET email = ? WHERE id = ?', 'ADMIN@example.com', adminId);
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin@example.com',
    password: 'correct-horse-battery',
  }).expect(200);
  const userRegistration = await request(app).post('/api/auth/register').send({
    name: 'Taylor Driver',
    email: 'taylor@example.com',
    password: 'correct-horse-battery',
  }).expect(201);
  const userLogin = await request(app).post('/api/auth/login').send({
    email: 'taylor@example.com',
    password: 'correct-horse-battery',
  }).expect(200);

  await request(app).post('/api/auth/register').send({
    name: 'Duplicate Admin',
    email: 'admin@example.com',
    password: 'correct-horse-battery',
  }).expect(409);

  const created = await request(app).post('/api/vehicles')
    .set(withToken(adminLogin.body.token))
    .send({
      make: 'Volvo',
      model: 'XC60',
      category: 'SUV',
      price: 42000,
      quantity: 2,
      fuelType: 'hybrid',
      status: 'listed',
    }).expect(201);
  const vehicleId = created.body.vehicle.id;

  const publicListing = await request(app)
    .get('/api/public/vehicles?make=volvo&fuelType=hybrid')
    .expect(200);
  assert.equal(publicListing.body.vehicles.length, 1);
  assert.equal(publicListing.body.pagination.total, 1);

  const secondVehicle = await request(app).post('/api/vehicles')
    .set(withToken(adminLogin.body.token))
    .send({
      make: 'Honda',
      model: 'City',
      category: 'Sedan',
      price: 18000,
      quantity: 3,
      fuelType: 'petrol',
      status: 'listed',
    }).expect(201);
  const recommendations = await request(app).post('/api/ai/car-finder')
    .set(withToken(userLogin.body.token))
    .send({ query: 'hybrid SUV under 50000' })
    .expect(200);
  assert.equal(recommendations.body.matches[0].vehicle.id, vehicleId);
  const comparison = await request(app).post('/api/ai/car-finder/compare')
    .set(withToken(userLogin.body.token))
    .send({ vehicle_ids: [vehicleId, secondVehicle.body.vehicle.id] })
    .expect(200);
  assert.equal(comparison.body.vehicles.length, 2);

  await request(app).post(`/api/vehicles/${vehicleId}/purchase`)
    .set(withToken(userLogin.body.token))
    .expect(200);
  const savedVehicle = await db.get('SELECT quantity FROM vehicles WHERE id = ?', vehicleId);
  const savedPurchase = await db.get('SELECT unit_price, total_amount FROM purchases WHERE vehicle_id = ?', vehicleId);
  assert.equal(savedVehicle.quantity, 1);
  assert.equal(Number(savedPurchase.unit_price), 42000);
  assert.equal(Number(savedPurchase.total_amount), 42000);

  const enquiry = await request(app).post('/api/enquiries').send({
    submissionKey: 'd53324ed-225c-4edf-8101-7fb59b75d4a2',
    customerName: 'Alex Customer',
    email: 'alex@example.com',
    phone: '',
    subject: 'Question about this vehicle',
    message: 'I would like to know more about this vehicle.',
    vehicleId,
  }).expect(201);
  assert.ok(enquiry.body.id);

  const dashboard = await request(app).get('/api/admin/dashboard')
    .set(withToken(adminLogin.body.token))
    .expect(200);
  assert.equal(dashboard.body.inventory.totalVehicles, 2);
  assert.equal(dashboard.body.inventory.availableVehicles, 2);
  assert.equal(dashboard.body.enquiries.total, 1);

  const enquiries = await request(app).get('/api/admin/enquiries?search=ALEX')
    .set(withToken(adminLogin.body.token))
    .expect(200);
  assert.equal(enquiries.body.enquiries.length, 1);
  await request(app).patch(`/api/admin/enquiries/${enquiry.body.id}`)
    .set(withToken(adminLogin.body.token))
    .send({ status: 'contacted' })
    .expect(200);
  const restock = await request(app).post(`/api/vehicles/${vehicleId}/restock`)
    .set(withToken(adminLogin.body.token))
    .send({ quantity: 2 })
    .expect(200);
  assert.equal(restock.body.vehicle.quantity, 3);

  await request(app).post('/api/auth/logout')
    .set(withToken(userLogin.body.token))
    .expect(204);
  await request(app).get('/api/auth/me')
    .set(withToken(userLogin.body.token))
    .expect(401);
});
