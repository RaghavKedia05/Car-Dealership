const { randomUUID } = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const { z, ZodError } = require('zod');

const passwordSchema = z.string().min(12).refine(
  (password) => Buffer.byteLength(password, 'utf8') <= 72,
  'Password must be no longer than 72 UTF-8 bytes',
);

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

const vehicleSchema = z.object({
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  category: z.string().trim().min(1).max(40),
  price: z.number().finite().positive(),
  quantity: z.number().int().min(0).max(1_000_000),
});

const searchSchema = z.object({
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  category: z.string().trim().max(40).optional(),
  minPrice: z.coerce.number().finite().min(0).optional(),
  maxPrice: z.coerce.number().finite().min(0).optional(),
}).refine(
  ({ minPrice, maxPrice }) => minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
  { message: 'minPrice must not exceed maxPrice' },
);

const restockSchema = z.object({
  quantity: z.number().int().positive().max(1_000_000),
});

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function toVehicle(row) {
  if (!row) return null;
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    category: row.category,
    price: row.price,
    quantity: row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validate(schema, input, res) {
  const result = schema.safeParse(input);
  if (!result.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: result.error.issues.map(({ path: field, message }) => ({
        field: field.join('.'),
        message,
      })),
    });
    return null;
  }
  return result.data;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function createApp({ db, jwtSecret = process.env.JWT_SECRET } = {}) {
  if (!db) throw new Error('A database connection is required');
  if (!jwtSecret) throw new Error('JWT_SECRET must be configured');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  const requireAuth = (req, res, next) => {
    const authorization = req.get('authorization');
    const match = authorization && authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let claims;
    try {
      claims = jwt.verify(match[1], jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(claims.sub);
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  };

  const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    next();
  };

  app.post('/api/auth/register', async (req, res) => {
    const input = validate(registrationSchema, req.body, res);
    if (!input) return;

    try {
      const user = {
        id: randomUUID(),
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
      };
      db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
        .run(user.id, user.name, user.email, user.passwordHash);
      return res.status(201).json({
        user: publicUser({ ...user, role: 'user' }),
      });
    } catch (error) {
      if (error.code === 'ERR_SQLITE_ERROR' && /UNIQUE constraint failed: users\.email/i.test(error.message)) {
        return res.status(409).json({ error: 'An account with that email already exists' });
      }
      throw error;
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const input = validate(loginSchema, req.body, res);
    if (!input) return;

    const user = db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?')
      .get(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }

    const token = jwt.sign({}, jwtSecret, { subject: user.id, expiresIn: '8h' });
    return res.json({ token, user: publicUser(user) });
  });

  app.get('/api/vehicles/search', requireAuth, (req, res) => {
    const filters = validate(searchSchema, req.query, res);
    if (!filters) return;

    const conditions = [];
    const values = [];
    for (const field of ['make', 'model', 'category']) {
      if (filters[field]) {
        conditions.push(`${field} LIKE ? ESCAPE '\\'`);
        values.push(`%${escapeLike(filters[field])}%`);
      }
    }
    if (filters.minPrice !== undefined) {
      conditions.push('price >= ?');
      values.push(filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      conditions.push('price <= ?');
      values.push(filters.maxPrice);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM vehicles ${where} ORDER BY created_at DESC, id ASC`).all(...values);
    return res.json({ vehicles: rows.map(toVehicle) });
  });

  app.get('/api/vehicles', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC, id ASC').all();
    return res.json({ vehicles: rows.map(toVehicle) });
  });

  app.get('/api/vehicles/:id', requireAuth, (req, res) => {
    const vehicle = toVehicle(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id));
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    return res.json({ vehicle });
  });

  app.post('/api/vehicles', requireAuth, requireAdmin, (req, res) => {
    const input = validate(vehicleSchema, req.body, res);
    if (!input) return;

    const id = randomUUID();
    db.prepare(`
      INSERT INTO vehicles (id, make, model, category, price, quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.make, input.model, input.category, input.price, input.quantity);
    const vehicle = toVehicle(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id));
    return res.status(201).json({ vehicle });
  });

  app.put('/api/vehicles/:id', requireAuth, requireAdmin, (req, res) => {
    const input = validate(vehicleSchema, req.body, res);
    if (!input) return;

    const result = db.prepare(`
      UPDATE vehicles
      SET make = ?, model = ?, category = ?, price = ?, quantity = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(input.make, input.model, input.category, input.price, input.quantity, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });

    const vehicle = toVehicle(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id));
    return res.json({ vehicle });
  });

  app.delete('/api/vehicles/:id', requireAuth, requireAdmin, (req, res) => {
    const result = db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });
    return res.status(204).end();
  });

  app.post('/api/vehicles/:id/purchase', requireAuth, (req, res) => {
    const result = db.prepare(`
      UPDATE vehicles
      SET quantity = quantity - 1, updated_at = datetime('now')
      WHERE id = ? AND quantity > 0
    `).run(req.params.id);

    if (result.changes === 0) {
      const exists = db.prepare('SELECT 1 FROM vehicles WHERE id = ?').get(req.params.id);
      return res.status(exists ? 409 : 404).json({
        error: exists ? 'Vehicle is out of stock' : 'Vehicle not found',
      });
    }

    const vehicle = toVehicle(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id));
    return res.json({ vehicle });
  });

  app.post('/api/vehicles/:id/restock', requireAuth, requireAdmin, (req, res) => {
    const input = validate(restockSchema, req.body, res);
    if (!input) return;

    const result = db.prepare(`
      UPDATE vehicles
      SET quantity = quantity + ?, updated_at = datetime('now')
      WHERE id = ? AND quantity <= 1000000 - ?
    `).run(input.quantity, req.params.id, input.quantity);
    if (result.changes === 0) {
      const exists = db.prepare('SELECT 1 FROM vehicles WHERE id = ?').get(req.params.id);
      return res.status(exists ? 400 : 404).json({
        error: exists ? 'Restock would exceed the maximum inventory quantity' : 'Vehicle not found',
      });
    }

    const vehicle = toVehicle(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id));
    return res.json({ vehicle });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.get(/.*/, (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'), (error) => {
      if (error) next(error);
    });
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'Malformed JSON request body' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
