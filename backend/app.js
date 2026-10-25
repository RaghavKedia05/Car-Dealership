const { randomUUID } = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { z, ZodError } = require('zod');
const {
  buildComparison,
  compareRequestSchema,
  findCars,
  finderRequestSchema,
} = require('./ai-car-finder');

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
  bodyType: z.string().trim().min(1).max(40).nullable().optional(),
  year: z.number().int().min(1886).max(2100).nullable().optional(),
  fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg']).nullable().optional(),
  transmission: z.enum(['automatic', 'manual']).nullable().optional(),
  seatingCapacity: z.number().int().min(1).max(20).nullable().optional(),
  mileageKmpl: z.number().finite().positive().max(200).nullable().optional(),
  electricRangeKm: z.number().finite().positive().max(3000).nullable().optional(),
  engineCapacityCc: z.number().int().positive().max(20_000).nullable().optional(),
  groundClearanceMm: z.number().int().positive().max(1000).nullable().optional(),
  safetyFeatures: z.string().trim().max(500).nullable().optional(),
  variant: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  imageUrl: z.string().url().refine((url) => url.startsWith('https://'), 'Image URL must use HTTPS')
    .nullable().optional(),
  status: z.enum(['listed', 'unlisted']).optional(),
});

const vehicleQuerySchema = z.object({
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  category: z.string().trim().max(40).optional(),
  minPrice: z.coerce.number().finite().min(0).optional(),
  maxPrice: z.coerce.number().finite().min(0).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  sortBy: z.enum(['make', 'model', 'category', 'price', 'createdAt']).default('createdAt'),
  bodyType: z.string().trim().max(40).optional(),
  fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg']).optional(),
  transmission: z.enum(['automatic', 'manual']).optional(),
  minSeats: z.coerce.number().int().min(1).max(20).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  ({ minPrice, maxPrice }) => minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
  { message: 'minPrice must not exceed maxPrice' },
);

const restockSchema = z.object({
  quantity: z.number().int().positive().max(1_000_000),
});

const publicVehicleQuerySchema = vehicleQuerySchema.safeExtend({
  keyword: z.string().trim().max(120).optional(),
  sortBy: z.enum(['make', 'model', 'category', 'price', 'createdAt', 'year']).default('createdAt'),
});

const enquirySchema = z.object({
  submissionKey: z.string().uuid(),
  customerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: z.string().trim().max(30)
    .refine((phone) => !phone || /^[+()\d .-]{7,30}$/.test(phone), 'Enter a valid phone number')
    .optional().default(''),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(4000),
  vehicleId: z.string().uuid().nullable().optional(),
});

const enquiryQuerySchema = z.object({
  status: z.enum(['new', 'contacted', 'in_progress', 'resolved']).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const enquiryStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'in_progress', 'resolved']),
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
    bodyType: row.body_type ?? null,
    year: row.vehicle_year ?? null,
    fuelType: row.fuel_type ?? null,
    transmission: row.transmission ?? null,
    seatingCapacity: row.seating_capacity ?? null,
    mileageKmpl: row.mileage_kmpl ?? null,
    electricRangeKm: row.electric_range_km ?? null,
    engineCapacityCc: row.engine_capacity_cc ?? null,
    groundClearanceMm: row.ground_clearance_mm ?? null,
    safetyFeatures: row.safety_features ?? null,
    variant: row.variant ?? null,
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    status: row.status ?? 'listed',
  };
}

function toEnquiry(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    status: row.status,
    vehicle: row.vehicle_id ? {
      id: row.vehicle_id,
      make: row.vehicle_make,
      model: row.vehicle_model,
    } : null,
    userId: row.user_id,
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

function createApp({
  db,
  jwtSecret = process.env.JWT_SECRET,
  authRateLimit = {},
  aiParser,
  aiRateLimit = {},
} = {}) {
  if (!db) throw new Error('A database connection is required');
  if (!jwtSecret) throw new Error('JWT_SECRET must be configured');

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }));
  app.use(express.json({ limit: '32kb' }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Too many authentication attempts' }),
    ...authRateLimit,
  });
  const finderLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Too many AI finder requests' }),
    ...aiRateLimit,
  });
  const enquiryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Too many enquiries. Please try again later.' }),
  });

  app.get('/healthz', (_req, res) => {
    db.prepare('SELECT 1').get();
    return res.json({ status: 'ok' });
  });

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
    if (!claims.jti || !claims.exp) {
      return res.status(401).json({ error: 'Please sign in again to continue' });
    }

    const user = db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').get(claims.sub);
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'Invalid or expired token' });
    if (db.prepare('SELECT 1 FROM revoked_tokens WHERE token_id = ?').get(claims.jti)) {
      return res.status(401).json({ error: 'This session has been signed out' });
    }
    req.user = user;
    req.authTokenId = claims.jti;
    req.authTokenExpiresAt = claims.exp;
    next();
  };

  const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    next();
  };
  const optionalAuth = (req, res, next) => {
    if (!req.get('authorization')) return next();
    return requireAuth(req, res, next);
  };

  app.get('/api/auth/me', requireAuth, (req, res) => {
    return res.json({ user: publicUser(req.user) });
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    db.prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?').run(Math.floor(Date.now() / 1000));
    db.prepare('INSERT OR IGNORE INTO revoked_tokens (token_id, expires_at) VALUES (?, ?)')
      .run(req.authTokenId, req.authTokenExpiresAt);
    return res.status(204).end();
  });

  app.post('/api/ai/car-finder', requireAuth, finderLimiter, async (req, res) => {
    const input = validate(finderRequestSchema, req.body, res);
    if (!input) return;
    const result = await findCars(db, input.query, {
      providerParser: aiParser,
      listedOnly: req.user.role !== 'admin',
    });
    return res.json(result);
  });

  app.post('/api/ai/car-finder/compare', requireAuth, finderLimiter, (req, res) => {
    const input = validate(compareRequestSchema, req.body, res);
    if (!input) return;
    const placeholders = input.vehicle_ids.map(() => '?').join(', ');
    const vehicles = db.prepare(`
      SELECT * FROM vehicles
      WHERE id IN (${placeholders}) AND (? = 'admin' OR status = 'listed')
    `).all(...input.vehicle_ids, req.user.role);
    if (vehicles.length !== input.vehicle_ids.length) {
      return res.status(404).json({ error: 'One or more selected vehicles were not found' });
    }
    const ordered = input.vehicle_ids.map((id) => vehicles.find((vehicle) => vehicle.id === id));
    return res.json(buildComparison(ordered, input.original_query));
  });

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const input = validate(registrationSchema, req.body, res);
    if (!input) return;

    try {
      const user = {
        id: randomUUID(),
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
      };
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `)
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

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const input = validate(loginSchema, req.body, res);
    if (!input) return;

    const user = db.prepare('SELECT id, name, email, role, status, password_hash FROM users WHERE email = ?')
      .get(input.email);
    if (!user || user.status !== 'active' || !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }

    const token = jwt.sign({}, jwtSecret, {
      subject: user.id,
      expiresIn: '8h',
      jwtid: randomUUID(),
    });
    return res.json({ token, user: publicUser(user) });
  });

  function listVehicles(req, res, { publicOnly = false } = {}) {
    const filters = validate(publicOnly ? publicVehicleQuerySchema : vehicleQuerySchema, req.query, res);
    if (!filters) return;

    const conditions = [];
    const values = [];
    for (const field of ['make', 'model', 'category']) {
      if (filters[field]) {
        conditions.push(`${field} LIKE ? ESCAPE '\\'`);
        values.push(`%${escapeLike(filters[field])}%`);
      }
    }
    if (publicOnly && filters.keyword) {
      const term = `%${escapeLike(filters.keyword)}%`;
      conditions.push("(make LIKE ? ESCAPE '\\' OR model LIKE ? ESCAPE '\\' OR variant LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
      values.push(term, term, term, term);
    }
    if (publicOnly) conditions.push("status = 'listed'");
    if (filters.bodyType) {
      conditions.push("body_type LIKE ? ESCAPE '\\'");
      values.push(`%${escapeLike(filters.bodyType)}%`);
    }
    if (filters.fuelType) {
      conditions.push('fuel_type = ?');
      values.push(filters.fuelType);
    }
    if (filters.transmission) {
      conditions.push('transmission = ?');
      values.push(filters.transmission);
    }
    if (filters.minSeats !== undefined) {
      conditions.push('seating_capacity >= ?');
      values.push(filters.minSeats);
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
    const columns = {
      make: 'make',
      model: 'model',
      category: 'category',
      price: 'price',
      createdAt: 'created_at',
      year: 'vehicle_year',
    };
    const order = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const offset = (filters.page - 1) * filters.pageSize;
    const total = db.prepare(`SELECT COUNT(*) AS total FROM vehicles ${where}`).get(...values).total;
    const rows = db.prepare(`
      SELECT * FROM vehicles ${where}
      ORDER BY ${columns[filters.sortBy]} ${order}, id ASC
      LIMIT ? OFFSET ?
    `).all(...values, filters.pageSize, offset);
    return res.json({
      vehicles: rows.map(toVehicle),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    });
  }

  app.get('/api/vehicles/search', requireAuth, (req, res) => (
    listVehicles(req, res, { publicOnly: req.user.role !== 'admin' })
  ));
  app.get('/api/vehicles', requireAuth, (req, res) => (
    listVehicles(req, res, { publicOnly: req.user.role !== 'admin' })
  ));
  app.get('/api/public/vehicles', (req, res) => listVehicles(req, res, { publicOnly: true }));

  app.get('/api/public/vehicles/:id', (req, res) => {
    const row = db.prepare("SELECT * FROM vehicles WHERE id = ? AND status = 'listed'").get(req.params.id);
    const vehicle = toVehicle(row);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    return res.json({ vehicle });
  });

  app.get('/api/vehicles/:id', requireAuth, (req, res) => {
    const vehicle = toVehicle(db.prepare(`
      SELECT * FROM vehicles WHERE id = ? AND (? = 'admin' OR status = 'listed')
    `).get(req.params.id, req.user.role));
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    return res.json({ vehicle });
  });

  app.post('/api/vehicles', requireAuth, requireAdmin, (req, res) => {
    const input = validate(vehicleSchema, req.body, res);
    if (!input) return;

    const id = randomUUID();
    db.prepare(`
      INSERT INTO vehicles (
        id, make, model, category, price, quantity, body_type, vehicle_year, fuel_type,
        transmission, seating_capacity, mileage_kmpl, electric_range_km, engine_capacity_cc,
        ground_clearance_mm, safety_features, variant, description, image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, input.make, input.model, input.category, input.price, input.quantity,
      input.bodyType ?? null, input.year ?? null, input.fuelType ?? null, input.transmission ?? null,
      input.seatingCapacity ?? null, input.mileageKmpl ?? null, input.electricRangeKm ?? null,
      input.engineCapacityCc ?? null, input.groundClearanceMm ?? null, input.safetyFeatures ?? null,
      input.variant ?? null, input.description ?? null, input.imageUrl ?? null, input.status ?? 'listed',
    );
    const vehicle = toVehicle(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id));
    return res.status(201).json({ vehicle });
  });

  app.put('/api/vehicles/:id', requireAuth, requireAdmin, (req, res) => {
    const input = validate(vehicleSchema, req.body, res);
    if (!input) return;

    const result = db.prepare(`
      UPDATE vehicles
      SET make = ?, model = ?, category = ?, price = ?, quantity = ?, body_type = ?,
          vehicle_year = ?, fuel_type = ?, transmission = ?, seating_capacity = ?, mileage_kmpl = ?,
          electric_range_km = ?, engine_capacity_cc = ?, ground_clearance_mm = ?, safety_features = ?,
          variant = ?, description = ?, image_url = ?, status = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      input.make, input.model, input.category, input.price, input.quantity, input.bodyType ?? null,
      input.year ?? null, input.fuelType ?? null, input.transmission ?? null,
      input.seatingCapacity ?? null, input.mileageKmpl ?? null, input.electricRangeKm ?? null,
      input.engineCapacityCc ?? null, input.groundClearanceMm ?? null, input.safetyFeatures ?? null,
      input.variant ?? null, input.description ?? null, input.imageUrl ?? null, input.status ?? 'listed',
      req.params.id,
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });

    const vehicle = toVehicle(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id));
    return res.json({ vehicle });
  });

  app.delete('/api/vehicles/:id', requireAuth, requireAdmin, (req, res) => {
    const hasPurchases = db.prepare('SELECT 1 FROM purchases WHERE vehicle_id = ? LIMIT 1')
      .get(req.params.id);
    if (hasPurchases) {
      return res.status(409).json({ error: 'Vehicle has purchase history and cannot be deleted' });
    }

    const result = db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });
    return res.status(204).end();
  });

  app.post('/api/vehicles/:id/purchase', requireAuth, (req, res) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const vehicle = db.prepare(`
        SELECT id, price FROM vehicles WHERE id = ? AND (? = 'admin' OR status = 'listed')
      `).get(req.params.id, req.user.role);
      if (!vehicle) {
        db.exec('ROLLBACK');
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      const result = db.prepare(`
        UPDATE vehicles
        SET quantity = quantity - 1, updated_at = datetime('now')
        WHERE id = ? AND quantity > 0
      `).run(req.params.id);
      if (result.changes === 0) {
        db.exec('ROLLBACK');
        return res.status(409).json({ error: 'Vehicle is out of stock' });
      }

      const purchaseId = randomUUID();
      db.prepare(`
        INSERT INTO purchases (id, vehicle_id, user_id, quantity, unit_price, total_amount)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(purchaseId, vehicle.id, req.user.id, vehicle.price, vehicle.price);
      const updatedVehicle = toVehicle(
        db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id),
      );
      db.exec('COMMIT');
      return res.json({
        vehicle: updatedVehicle,
        purchase: {
          id: purchaseId,
          vehicleId: vehicle.id,
          quantity: 1,
          unitPrice: vehicle.price,
          totalAmount: vehicle.price,
        },
      });
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
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

  app.post('/api/enquiries', optionalAuth, enquiryLimiter, (req, res) => {
    const input = validate(enquirySchema, req.body, res);
    if (!input) return;

    if (input.vehicleId) {
      const vehicle = db.prepare("SELECT 1 FROM vehicles WHERE id = ? AND status = 'listed'")
        .get(input.vehicleId);
      if (!vehicle) return res.status(404).json({ error: 'Selected vehicle is not available' });
    }

    const id = randomUUID();
    try {
      db.prepare(`
        INSERT INTO enquiries (
          id, submission_key, user_id, vehicle_id, customer_name, email, phone, subject, message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, input.submissionKey, req.user?.id ?? null, input.vehicleId ?? null,
        input.customerName, input.email, input.phone, input.subject, input.message,
      );
    } catch (error) {
      if (error.code === 'ERR_SQLITE_ERROR'
        && /UNIQUE constraint failed: enquiries\.submission_key/i.test(error.message)) {
        return res.status(409).json({ error: 'This enquiry has already been submitted' });
      }
      throw error;
    }
    return res.status(201).json({ id, status: 'new', message: 'Thank you. Your enquiry has been received.' });
  });

  app.get('/api/admin/dashboard', requireAuth, requireAdmin, (_req, res) => {
    const inventory = db.prepare(`
      SELECT
        COUNT(*) AS totalVehicles,
        COALESCE(SUM(CASE WHEN quantity > 0 AND status = 'listed' THEN 1 ELSE 0 END), 0) AS availableVehicles,
        COALESCE(SUM(CASE WHEN quantity = 0 AND status = 'listed' THEN 1 ELSE 0 END), 0) AS soldVehicles,
        COALESCE(SUM(CASE WHEN status = 'listed' THEN price * quantity ELSE 0 END), 0) AS inventoryValue
      FROM vehicles
    `).get();
    const enquiries = db.prepare(`
      SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0) AS pending
      FROM enquiries
    `).get();
    const groupRows = (column) => db.prepare(`
      SELECT COALESCE(NULLIF(${column}, ''), 'Not recorded') AS label, COUNT(*) AS count
      FROM vehicles
      WHERE status = 'listed'
      GROUP BY ${column}
      ORDER BY count DESC, label ASC
      LIMIT 8
    `).all();
    const recentVehicles = db.prepare(`
      SELECT * FROM vehicles ORDER BY updated_at DESC, id ASC LIMIT 5
    `).all().map(toVehicle);
    const recentEnquiries = db.prepare(`
      SELECT e.*, v.make AS vehicle_make, v.model AS vehicle_model
      FROM enquiries e LEFT JOIN vehicles v ON v.id = e.vehicle_id
      ORDER BY e.created_at DESC, e.id ASC LIMIT 5
    `).all().map(toEnquiry);
    return res.json({
      inventory,
      enquiries,
      groups: {
        make: groupRows('make'),
        bodyType: groupRows('body_type'),
        fuelType: groupRows('fuel_type'),
      },
      recentVehicles,
      recentEnquiries,
    });
  });

  app.get('/api/admin/enquiries', requireAuth, requireAdmin, (req, res) => {
    const filters = validate(enquiryQuerySchema, req.query, res);
    if (!filters) return;
    const conditions = [];
    const values = [];
    if (filters.status) {
      conditions.push('e.status = ?');
      values.push(filters.status);
    }
    if (filters.search) {
      const query = `%${escapeLike(filters.search)}%`;
      conditions.push("(e.customer_name LIKE ? ESCAPE '\\' OR e.email LIKE ? ESCAPE '\\' OR e.subject LIKE ? ESCAPE '\\')");
      values.push(query, query, query);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) AS total FROM enquiries e ${where}`).get(...values).total;
    const rows = db.prepare(`
      SELECT e.*, v.make AS vehicle_make, v.model AS vehicle_model
      FROM enquiries e LEFT JOIN vehicles v ON v.id = e.vehicle_id
      ${where}
      ORDER BY e.created_at DESC, e.id ASC LIMIT ? OFFSET ?
    `).all(...values, filters.pageSize, (filters.page - 1) * filters.pageSize);
    return res.json({
      enquiries: rows.map(toEnquiry),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    });
  });

  app.get('/api/admin/enquiries/:id', requireAuth, requireAdmin, (req, res) => {
    const enquiry = db.prepare(`
      SELECT e.*, v.make AS vehicle_make, v.model AS vehicle_model
      FROM enquiries e LEFT JOIN vehicles v ON v.id = e.vehicle_id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });
    return res.json({ enquiry: toEnquiry(enquiry) });
  });

  app.patch('/api/admin/enquiries/:id', requireAuth, requireAdmin, (req, res) => {
    const input = validate(enquiryStatusSchema, req.body, res);
    if (!input) return;
    const result = db.prepare(`
      UPDATE enquiries SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(input.status, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Enquiry not found' });
    const enquiry = db.prepare(`
      SELECT e.*, v.make AS vehicle_make, v.model AS vehicle_model
      FROM enquiries e LEFT JOIN vehicles v ON v.id = e.vehicle_id
      WHERE e.id = ?
    `).get(req.params.id);
    return res.json({ enquiry: toEnquiry(enquiry) });
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
