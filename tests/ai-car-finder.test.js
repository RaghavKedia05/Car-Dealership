const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../backend/app');
const { createDatabase } = require('../backend/database');
const {
  buildComparison,
  generateAlternatives,
  parseCriteria,
  parseNaturalQuery,
  recommendVehicles,
} = require('../backend/ai-car-finder');

function vehicle(overrides = {}) {
  return {
    id: 'vehicle-1',
    make: 'Example',
    model: 'Family',
    category: 'SUV',
    price: 1_800_000,
    quantity: 2,
    seating_capacity: 5,
    fuel_type: 'petrol',
    transmission: 'automatic',
    mileage_kmpl: 18,
    electric_range_km: null,
    ground_clearance_mm: 190,
    vehicle_year: 2023,
    ...overrides,
  };
}

test('natural language parser extracts SUV budget, seats, and fuel-economy preference', () => {
  const criteria = parseNaturalQuery('Find an SUV under ₹20 lakh with at least five seats and good fuel economy');

  assert.equal(criteria.category, 'SUV');
  assert.equal(criteria.maxPrice, 2_000_000);
  assert.equal(criteria.minSeatingCapacity, 5);
  assert.ok(criteria.preferences.includes('fuel_economy'));
  assert.ok(criteria.mustHave.length >= 3);
});

test('natural language parser understands crore amounts and common vehicle synonyms', () => {
  const criteria = parseNaturalQuery('Need an EV with automatic transmission, not more than ₹1.2 crore');

  assert.equal(criteria.fuelType, 'electric');
  assert.equal(criteria.transmission, 'automatic');
  assert.equal(criteria.maxPrice, 12_000_000);
});

test('natural language parser requests clarification for contradictory price limits', () => {
  const criteria = parseNaturalQuery('Find a car under ₹10 lakh but above ₹20 lakh');

  assert.equal(criteria.needsClarification, true);
  assert.ok(criteria.clarificationQuestion);
});

test('provider criteria are schema-validated and summarized as hard filters', async () => {
  const parsed = await parseCriteria('family SUV', {
    providerParser: async () => ({ category: 'SUV', minSeatingCapacity: 5 }),
  });

  assert.equal(parsed.parser, 'provider');
  assert.equal(parsed.criteria.category, 'SUV');
  assert.equal(parsed.criteria.minSeatingCapacity, 5);
  assert.ok(parsed.criteria.mustHave.includes('Category: SUV'));
  assert.ok(parsed.criteria.mustHave.includes('At least 5 seats'));
});

test('recommendations enforce hard filters and rank only from known specifications', () => {
  const criteria = parseNaturalQuery('SUV under ₹20 lakh with good fuel economy');
  const vehicles = [
    vehicle({ id: 'efficient', mileage_kmpl: 22 }),
    vehicle({ id: 'missing-mileage', mileage_kmpl: null }),
    vehicle({ id: 'over-budget', price: 2_100_000 }),
    vehicle({ id: 'wrong-category', category: 'Sedan' }),
  ];

  const result = recommendVehicles(criteria, vehicles);

  assert.deepEqual(result.matches.map(({ vehicle: item }) => item.id), ['efficient', 'missing-mileage']);
  assert.ok(result.matches[0].score > result.matches[1].score);
  assert.match(result.matches[1].explanation, /mileage data is unavailable/i);
  assert.equal(result.alternatives.length, 0);
});

test('explicitly excluded vehicle attributes never appear in recommendations', () => {
  const criteria = parseNaturalQuery('SUV under ₹20 lakh without diesel');
  const result = recommendVehicles(criteria, [
    vehicle({ id: 'petrol', fuel_type: 'petrol' }),
    vehicle({ id: 'diesel', fuel_type: 'diesel' }),
  ]);

  assert.ok(criteria.excluded.includes('diesel'));
  assert.deepEqual(result.matches.map(({ vehicle: item }) => item.id), ['petrol']);
});

test('no exact matches produces clearly labelled alternatives relaxing one hard filter', () => {
  const criteria = parseNaturalQuery('SUV under ₹15 lakh with diesel fuel');
  const inventory = [
    vehicle({ id: 'over-budget', price: 1_700_000, fuel_type: 'diesel' }),
    vehicle({ id: 'wrong-fuel', price: 1_400_000, fuel_type: 'petrol' }),
  ];
  const exact = recommendVehicles(criteria, inventory);
  const alternatives = generateAlternatives(criteria, inventory);

  assert.equal(exact.matches.length, 0);
  assert.equal(alternatives.length, 2);
  assert.ok(alternatives.every((item) => item.relaxedConstraint));
});

test('comparison returns current data, missing-spec notices, and grounded differences', () => {
  const result = buildComparison([
    vehicle({ id: 'one', mileage_kmpl: 20 }),
    vehicle({ id: 'two', mileage_kmpl: null, seating_capacity: 7 }),
  ], 'family car with good mileage');

  assert.equal(result.vehicles.length, 2);
  assert.equal(result.rows.find(({ key }) => key === 'mileage_kmpl').values[1], null);
  assert.match(result.summary, /seating/i);
  assert.equal(result.vehicles[0].specifications.mileageKmpl, 20);
});

test('finder and comparison endpoints require authentication and validate comparison IDs', async (t) => {
  const db = createDatabase(':memory:');
  const app = createApp({ db, jwtSecret: 'test-secret-that-is-long-enough' });
  t.after(() => db.close());

  assert.equal((await request(app).post('/api/ai/car-finder').send({ query: 'SUV' })).status, 401);
  assert.equal((await request(app).post('/api/ai/car-finder/compare').send({ vehicle_ids: [] })).status, 401);

  const registration = await request(app).post('/api/auth/register').send({
    name: 'Finder User',
    email: 'finder@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(registration.status, 201);
  const login = await request(app).post('/api/auth/login').send({
    email: 'finder@example.com',
    password: 'correct-horse-battery',
  });
  const auth = { Authorization: `Bearer ${login.body.token}` };

  const invalidQuery = await request(app).post('/api/ai/car-finder')
    .set(auth).send({ query: 'x'.repeat(2001) });
  const invalidCompare = await request(app).post('/api/ai/car-finder/compare')
    .set(auth).send({ vehicle_ids: ['same', 'same'] });
  const singleCompare = await request(app).post('/api/ai/car-finder/compare')
    .set(auth).send({ vehicle_ids: ['00000000-0000-4000-8000-000000000001'] });
  assert.equal(invalidQuery.status, 400);
  assert.equal(invalidCompare.status, 400);
  assert.equal(singleCompare.status, 400);
});

test('finder endpoint uses real inventory and deterministic fallback when no provider is configured', async (t) => {
  const db = createDatabase(':memory:');
  const app = createApp({ db, jwtSecret: 'test-secret-that-is-long-enough' });
  t.after(() => db.close());
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Finder User',
    email: 'fallback@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(registration.status, 201);
  const login = await request(app).post('/api/auth/login').send({
    email: 'fallback@example.com',
    password: 'correct-horse-battery',
  });
  const auth = { Authorization: `Bearer ${login.body.token}` };
  db.prepare(`
    INSERT INTO vehicles (id, make, model, category, price, quantity, seating_capacity, fuel_type, mileage_kmpl)
    VALUES ('actual-car', 'Real Make', 'Real Model', 'SUV', 1800000, 2, 5, 'petrol', 18)
  `).run();

  const result = await request(app).post('/api/ai/car-finder')
    .set(auth).send({ query: 'SUV under ₹20 lakh with at least five seats and good fuel economy' });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.parser, 'deterministic');
  assert.equal(result.body.matches.length, 1, JSON.stringify(result.body));
  assert.equal(result.body.matches[0].vehicle.make, 'Real Make');
  assert.equal(result.body.matches[0].vehicle.price, 1_800_000);
  assert.equal(result.body.matches[0].isExactMatch, true);
});

test('provider errors fall back safely and report that deterministic parsing was used', async (t) => {
  const db = createDatabase(':memory:');
  const app = createApp({
    db,
    jwtSecret: 'test-secret-that-is-long-enough',
    aiParser: async () => { throw new Error('provider unavailable'); },
  });
  t.after(() => db.close());
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Finder User',
    email: 'provider-fallback@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(registration.status, 201);
  const login = await request(app).post('/api/auth/login').send({
    email: 'provider-fallback@example.com',
    password: 'correct-horse-battery',
  });

  const result = await request(app).post('/api/ai/car-finder')
    .set({ Authorization: `Bearer ${login.body.token}` })
    .send({ query: 'SUV under ₹20 lakh' });

  assert.equal(result.status, 200);
  assert.equal(result.body.parser, 'deterministic');
  assert.match(result.body.warning, /AI interpretation is unavailable/i);
});

test('comparison endpoint loads current vehicle records and rejects missing IDs', async (t) => {
  const db = createDatabase(':memory:');
  const app = createApp({ db, jwtSecret: 'test-secret-that-is-long-enough' });
  t.after(() => db.close());
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Finder User',
    email: 'compare@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(registration.status, 201);
  const login = await request(app).post('/api/auth/login').send({
    email: 'compare@example.com',
    password: 'correct-horse-battery',
  });
  const auth = { Authorization: `Bearer ${login.body.token}` };
  db.prepare(`
    INSERT INTO vehicles (id, make, model, category, price, quantity, seating_capacity)
    VALUES ('00000000-0000-4000-8000-000000000001', 'Current', 'Record', 'Sedan', 1200000, 1, 5)
  `).run();
  db.prepare(`
    INSERT INTO vehicles (id, make, model, category, price, quantity, seating_capacity)
    VALUES ('00000000-0000-4000-8000-000000000002', 'Current', 'Alternative', 'Sedan', 1300000, 1, 5)
  `).run();

  const missing = await request(app).post('/api/ai/car-finder/compare')
    .set(auth).send({
      vehicle_ids: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003'],
    });
  const compared = await request(app).post('/api/ai/car-finder/compare')
    .set(auth).send({
      vehicle_ids: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
      original_query: 'family car',
    });

  assert.equal(missing.status, 404);
  assert.equal(compared.status, 200);
  assert.equal(compared.body.vehicles.length, 2);
  assert.equal(compared.body.vehicles[0].model, 'Record');
  assert.equal(compared.body.vehicles[0].specifications.seatingCapacity, 5);
});
