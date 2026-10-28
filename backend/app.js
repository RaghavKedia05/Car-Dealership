const { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { expireCheckoutOrders } = require('./services/order-reservations');
const { z, ZodError } = require('zod');
const {
  buildComparison,
  compareRequestSchema,
  findCars,
  finderRequestSchema,
} = require('./services/ai-car-finder');

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

const accountProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).regex(/^[+\d(). -]*$/),
  deliveryAddress: z.string().trim().max(500),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(100),
  password: passwordSchema,
});

const registrationOtpSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  code: z.string().regex(/^\d{6}$/),
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

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: z.string().trim().min(7).max(20).regex(/^[+\d(). -]+$/),
  deliveryAddress: z.string().trim().min(8).max(500),
  paymentMethod: z.enum(['dealership', 'callback']),
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

const dealershipOrderActionSchema = z.object({
  status: z.enum(['paid', 'cancelled']),
});

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    deliveryAddress: user.delivery_address || '',
  };
}

async function sendPasswordResetEmail(email, token) {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.PASSWORD_RESET_FROM;
  const appOrigin = process.env.APP_ORIGIN;
  if (!apiKey || !sender || !appOrigin) return false;

  let parsedOrigin;
  try {
    parsedOrigin = new URL(appOrigin);
  } catch {
    throw new Error('APP_ORIGIN must be a valid HTTPS origin');
  }
  if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== appOrigin) {
    throw new Error('APP_ORIGIN must be an exact HTTPS origin');
  }

  const resetUrl = new URL('/reset-password', parsedOrigin);
  resetUrl.searchParams.set('token', token);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender,
      to: [email],
      subject: 'Reset your Apex Auto password',
      text: `Use this secure link to reset your Apex Auto password. It expires in 30 minutes: ${resetUrl.toString()} If you did not request this, ignore this email.`,
      html: `<p>Use the link below to reset your Apex Auto password. It expires in 30 minutes.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Password reset email provider returned HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }
  return true;
}

async function sendRegistrationCodeEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.PASSWORD_RESET_FROM;
  if (!apiKey || !sender) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender,
      to: [email],
      subject: 'Your Apex Auto verification code',
      text: `Your Apex Auto email verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      html: `<p>Your Apex Auto email verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request this, ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Registration email provider returned HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }
  return true;
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
  corsOrigins = [],
  authRateLimit = {},
  aiParser,
  aiRateLimit = {},
} = {}) {
  if (!db) throw new Error('A database connection is required');
  if (!jwtSecret) throw new Error('JWT_SECRET must be configured');
  if (!Array.isArray(corsOrigins)) throw new Error('CORS_ORIGINS must be an array of exact origins');

  const allowedOrigins = new Set(corsOrigins.map((origin) => {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
      throw new Error(`CORS origins must be exact HTTP(S) origins without paths: ${origin}`);
    }
    return origin;
  }));

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }));
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin) res.vary('Origin');
    if (!origin || !allowedOrigins.has(origin)) {
      if (origin && req.method === 'OPTIONS') {
        return res.status(403).json({ error: 'Origin is not allowed' });
      }
      return next();
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  });
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
  const checkoutLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Too many checkout attempts. Please try again later.' }),
  });
  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Too many password recovery attempts. Please try again later.' }),
  });
  const registrationOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Too many verification attempts. Please try again later.' }),
  });

  app.get('/healthz', async (_req, res) => {
    await db.get('SELECT 1');
    return res.json({ status: 'ok' });
  });

  const requireAuth = async (req, res, next) => {
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

    const user = await db.get('SELECT id, name, email, role, status, phone, delivery_address, auth_version FROM users WHERE id = ?', claims.sub);
    if (!user || user.status !== 'active' || claims.ver !== user.auth_version) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (await db.get('SELECT 1 FROM revoked_tokens WHERE token_id = ?', claims.jti)) {
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

  app.post('/api/auth/logout', requireAuth, async (req, res) => {
    await db.run('DELETE FROM revoked_tokens WHERE expires_at <= ?', Math.floor(Date.now() / 1000));
    await db.run(`INSERT INTO revoked_tokens (token_id, expires_at) VALUES (?, ?)
      ON CONFLICT (token_id) DO NOTHING`, req.authTokenId, req.authTokenExpiresAt);
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

  app.post('/api/ai/car-finder/compare', requireAuth, finderLimiter, async (req, res) => {
    const input = validate(compareRequestSchema, req.body, res);
    if (!input) return;
    const placeholders = input.vehicle_ids.map(() => '?').join(', ');
    const vehicles = await db.all(`
      SELECT * FROM vehicles
      WHERE id IN (${placeholders}) AND (? = 'admin' OR status = 'listed')
    `, ...input.vehicle_ids, req.user.role);
    if (vehicles.length !== input.vehicle_ids.length) {
      return res.status(404).json({ error: 'One or more selected vehicles were not found' });
    }
    const ordered = input.vehicle_ids.map((id) => vehicles.find((vehicle) => vehicle.id === id));
    return res.json(buildComparison(ordered, input.original_query));
  });

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const input = validate(registrationSchema, req.body, res);
    if (!input) return;
    if (!process.env.RESEND_API_KEY || !process.env.PASSWORD_RESET_FROM) {
      return res.status(503).json({ error: 'Email verification is not configured yet. Please contact the dealership.' });
    }
    if (await db.get('SELECT 1 FROM users WHERE LOWER(email) = LOWER(?)', input.email)) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const now = Date.now();
    const code = String(randomInt(100000, 1000000));
    const codeHash = createHmac('sha256', jwtSecret).update(`${input.email}:${code}`).digest('hex');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const challenge = await db.transaction(async (tx) => {
      await tx.run('DELETE FROM registration_verifications WHERE expires_at <= ?', now);
      const existing = await tx.get('SELECT id, sent_at FROM registration_verifications WHERE email = ?', input.email);
      if (existing && now - existing.sent_at < 60_000) return { state: 'cooldown' };
      if (existing) {
        await tx.run(`
          UPDATE registration_verifications
          SET name = ?, password_hash = ?, code_hash = ?, expires_at = ?, attempts = 0, sent_at = ?
          WHERE id = ?
        `, input.name, passwordHash, codeHash, now + 10 * 60 * 1000, now, existing.id);
        return { state: 'send', id: existing.id };
      }
      const id = randomUUID();
      await tx.run(`
        INSERT INTO registration_verifications
          (id, email, name, password_hash, code_hash, expires_at, attempts, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `, id, input.email, input.name, passwordHash, codeHash, now + 10 * 60 * 1000, now);
      return { state: 'send', id };
    });
    if (challenge.state === 'cooldown') {
      return res.status(429).json({ error: 'A code was just sent. Wait one minute before requesting another.' });
    }

    try {
      await sendRegistrationCodeEmail(input.email, code);
    } catch (error) {
      await db.run('DELETE FROM registration_verifications WHERE id = ? AND code_hash = ?', challenge.id, codeHash);
      console.error('Could not send registration verification code:', error.message);
      return res.status(502).json({ error: 'We could not send your verification code. Please try again shortly.' });
    }
    return res.status(202).json({ message: 'A six-digit verification code was sent to your email address.' });
  });

  app.post('/api/auth/register/verify', registrationOtpLimiter, async (req, res) => {
    const input = validate(registrationOtpSchema, req.body, res);
    if (!input) return;
    const now = Date.now();
    const submittedHash = createHmac('sha256', jwtSecret).update(`${input.email}:${input.code}`).digest('hex');
    const outcome = await db.transaction(async (tx) => {
      if (await tx.get('SELECT 1 FROM users WHERE LOWER(email) = LOWER(?)', input.email)) {
        return { state: 'duplicate' };
      }
      const challenge = await tx.get(
        'SELECT id, name, email, password_hash, code_hash, expires_at, attempts FROM registration_verifications WHERE email = ?',
        input.email,
      );
      if (!challenge || challenge.expires_at <= now) {
        if (challenge) await tx.run('DELETE FROM registration_verifications WHERE id = ?', challenge.id);
        return { state: 'invalid' };
      }
      if (challenge.attempts >= 5) return { state: 'locked' };
      const expectedHash = Buffer.from(challenge.code_hash, 'hex');
      const actualHash = Buffer.from(submittedHash, 'hex');
      if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
        await tx.run('UPDATE registration_verifications SET attempts = attempts + 1 WHERE id = ?', challenge.id);
        return { state: 'invalid' };
      }
      const consumed = await tx.run(
        'DELETE FROM registration_verifications WHERE id = ? AND code_hash = ? AND expires_at > ? AND attempts < 5',
        challenge.id, challenge.code_hash, now,
      );
      if (!consumed.changes) return { state: 'invalid' };
      const user = {
        id: randomUUID(),
        name: challenge.name,
        email: challenge.email,
        password_hash: challenge.password_hash,
        role: 'user',
        status: 'active',
        auth_version: 0,
      };
      await tx.run(`
        INSERT INTO users (id, name, email, password_hash, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, user.id, user.name, user.email, user.password_hash);
      return { state: 'verified', user };
    });
    if (outcome.state === 'locked') {
      return res.status(429).json({ error: 'Too many incorrect codes. Request a new verification code.' });
    }
    if (outcome.state === 'duplicate') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    if (outcome.state === 'invalid') {
      return res.status(400).json({ error: 'That verification code is invalid or expired. Request a new one.' });
    }

    const token = jwt.sign({ ver: outcome.user.auth_version }, jwtSecret, {
      subject: outcome.user.id,
      expiresIn: '8h',
      jwtid: randomUUID(),
    });
    return res.status(201).json({ token, user: publicUser(outcome.user) });
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const input = validate(loginSchema, req.body, res);
    if (!input) return;

    const user = await db.get('SELECT id, name, email, role, status, password_hash, phone, delivery_address, auth_version FROM users WHERE LOWER(email) = LOWER(?)', input.email);
    if (!user || user.status !== 'active' || !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }

    const token = jwt.sign({ ver: user.auth_version }, jwtSecret, {
      subject: user.id,
      expiresIn: '8h',
      jwtid: randomUUID(),
    });
    return res.json({ token, user: publicUser(user) });
  });

  app.get('/api/account', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

  app.put('/api/account', requireAuth, async (req, res) => {
    const input = validate(accountProfileSchema, req.body, res);
    if (!input) return;
    await db.run(`
      UPDATE users SET name = ?, phone = ?, delivery_address = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, input.name, input.phone || null, input.deliveryAddress || null, req.user.id);
    const user = await db.get(
      'SELECT id, name, email, role, phone, delivery_address FROM users WHERE id = ?',
      req.user.id,
    );
    return res.json({ user: publicUser(user) });
  });

  app.get('/api/account/orders', requireAuth, async (req, res) => {
    const completed = await db.all(`
      SELECT p.id, p.total_amount AS unit_price, p.created_at, 'paid' AS status,
             c.razorpay_payment_id, c.payment_method, COALESCE(c.customer_name, u.name) AS customer_name,
             COALESCE(c.email, u.email) AS email, COALESCE(c.phone, u.phone, '') AS phone,
             COALESCE(c.delivery_address, u.delivery_address, '') AS delivery_address,
             v.id AS vehicle_id, v.make, v.model, v.vehicle_year, v.image_url
      FROM purchases p
      JOIN users u ON u.id = p.user_id
      JOIN vehicles v ON v.id = p.vehicle_id
      LEFT JOIN checkout_orders c ON c.id = p.checkout_order_id
      WHERE p.user_id = ?
    `, req.user.id);
    const outstanding = await db.all(`
      SELECT c.id, c.vehicle_id, c.customer_name, c.email, c.phone, c.delivery_address,
             c.unit_price, c.status, c.razorpay_payment_id, c.payment_method, c.created_at,
             v.make, v.model, v.vehicle_year, v.image_url
      FROM checkout_orders c
      JOIN vehicles v ON v.id = c.vehicle_id
      WHERE c.user_id = ? AND c.status IN ('pending', 'cancelled', 'refunded', 'refunding', 'expired')
        AND NOT EXISTS (SELECT 1 FROM purchases p WHERE p.checkout_order_id = c.id)
    `, req.user.id);
    const rows = [...completed, ...outstanding].sort((left, right) => (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    ));
    return res.json({ orders: rows.map((row) => ({
      id: row.id,
      status: row.status,
      totalAmount: row.unit_price,
      paymentId: row.razorpay_payment_id,
      paymentMethod: row.payment_method || null,
      createdAt: row.created_at,
      customerName: row.customer_name,
      email: row.email,
      phone: row.phone,
      deliveryAddress: row.delivery_address,
      vehicle: {
        id: row.vehicle_id,
        make: row.make,
        model: row.model,
        year: row.vehicle_year,
        imageUrl: row.image_url,
      },
    })) });
  });

  app.post('/api/account/password', requireAuth, async (req, res) => {
    const input = validate(changePasswordSchema, req.body, res);
    if (!input) return;
    const account = await db.get('SELECT password_hash, auth_version FROM users WHERE id = ?', req.user.id);
    if (!account || !(await bcrypt.compare(input.currentPassword, account.password_hash))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await db.run(`
      UPDATE users SET password_hash = ?, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, passwordHash, req.user.id);
    const user = await db.get(
      'SELECT id, name, email, role, phone, delivery_address, auth_version FROM users WHERE id = ?',
      req.user.id,
    );
    const token = jwt.sign({ ver: user.auth_version }, jwtSecret, {
      subject: user.id,
      expiresIn: '8h',
      jwtid: randomUUID(),
    });
    return res.json({ token, user: publicUser(user) });
  });

  app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
    const input = validate(forgotPasswordSchema, req.body, res);
    if (!input) return;
    const responseMessage = 'If an account matches that email and recovery email is configured, a reset link will arrive shortly.';
    const user = await db.get('SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)', input.email);
    if (user && process.env.RESEND_API_KEY && process.env.PASSWORD_RESET_FROM && process.env.APP_ORIGIN) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await db.transaction(async (tx) => {
        await tx.run('DELETE FROM password_reset_tokens WHERE user_id = ?', user.id);
        await tx.run(`
          INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
          VALUES (?, ?, ?, ?)
        `, randomUUID(), user.id, tokenHash, Date.now() + 30 * 60 * 1000);
      });
      try {
        await sendPasswordResetEmail(user.email, token);
      } catch (error) {
        await db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', user.id);
        console.error('Could not send password reset email:', error.message);
      }
    }
    return res.json({ message: responseMessage });
  });

  app.post('/api/auth/reset-password', passwordResetLimiter, async (req, res) => {
    const input = validate(resetPasswordSchema, req.body, res);
    if (!input) return;
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const now = Date.now();
    const changed = await db.transaction(async (tx) => {
      const token = await tx.get(`
        SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
      `, tokenHash, now);
      if (!token) return false;
      const claimed = await tx.run(`
        UPDATE password_reset_tokens SET used_at = ?
        WHERE id = ? AND used_at IS NULL AND expires_at > ?
      `, now, token.id, now);
      if (!claimed.changes) return false;
      await tx.run(`
        UPDATE users SET password_hash = ?, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, passwordHash, token.user_id);
      await tx.run('DELETE FROM password_reset_tokens WHERE user_id = ? AND id <> ?', token.user_id, token.id);
      return true;
    });
    if (!changed) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
    return res.json({ message: 'Password updated. Sign in with your new password.' });
  });

  async function listVehicles(req, res, { publicOnly = false } = {}) {
    const filters = validate(publicOnly ? publicVehicleQuerySchema : vehicleQuerySchema, req.query, res);
    if (!filters) return;

    const conditions = [];
    const values = [];
    for (const field of ['make', 'model', 'category']) {
      if (filters[field]) {
        conditions.push(`LOWER(${field}) LIKE LOWER(?) ESCAPE '\\'`);
        values.push(`%${escapeLike(filters[field])}%`);
      }
    }
    if (publicOnly && filters.keyword) {
      const term = `%${escapeLike(filters.keyword)}%`;
      conditions.push("(LOWER(make) LIKE LOWER(?) ESCAPE '\\' OR LOWER(model) LIKE LOWER(?) ESCAPE '\\' OR LOWER(variant) LIKE LOWER(?) ESCAPE '\\' OR LOWER(description) LIKE LOWER(?) ESCAPE '\\')");
      values.push(term, term, term, term);
    }
    if (publicOnly) conditions.push("status = 'listed'");
    if (filters.bodyType) {
      conditions.push("LOWER(body_type) LIKE LOWER(?) ESCAPE '\\'");
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
    const total = Number((await db.get(`SELECT COUNT(*) AS total FROM vehicles ${where}`, ...values)).total);
    const rows = await db.all(`
      SELECT * FROM vehicles ${where}
      ORDER BY ${columns[filters.sortBy]} ${order}, id ASC
      LIMIT ? OFFSET ?
    `, ...values, filters.pageSize, offset);
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

  app.get('/api/vehicles/search', requireAuth, async (req, res) => (
    listVehicles(req, res, { publicOnly: req.user.role !== 'admin' })
  ));
  app.get('/api/vehicles', requireAuth, async (req, res) => (
    listVehicles(req, res, { publicOnly: req.user.role !== 'admin' })
  ));
  app.get('/api/public/vehicles', async (req, res) => listVehicles(req, res, { publicOnly: true }));

  app.get('/api/public/vehicles/:id', async (req, res) => {
    const row = await db.get("SELECT * FROM vehicles WHERE id = ? AND status = 'listed'", req.params.id);
    const vehicle = toVehicle(row);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    return res.json({ vehicle });
  });

  app.get('/api/vehicles/:id', requireAuth, async (req, res) => {
    const vehicle = toVehicle(await db.get(`
      SELECT * FROM vehicles WHERE id = ? AND (? = 'admin' OR status = 'listed')
    `, req.params.id, req.user.role));
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    return res.json({ vehicle });
  });

  app.post('/api/vehicles', requireAuth, requireAdmin, async (req, res) => {
    const input = validate(vehicleSchema, req.body, res);
    if (!input) return;

    const id = randomUUID();
    await db.run(`
      INSERT INTO vehicles (
        id, make, model, category, price, quantity, body_type, vehicle_year, fuel_type,
        transmission, seating_capacity, mileage_kmpl, electric_range_km, engine_capacity_cc,
        ground_clearance_mm, safety_features, variant, description, image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id, input.make, input.model, input.category, input.price, input.quantity,
      input.bodyType ?? null, input.year ?? null, input.fuelType ?? null, input.transmission ?? null,
      input.seatingCapacity ?? null, input.mileageKmpl ?? null, input.electricRangeKm ?? null,
      input.engineCapacityCc ?? null, input.groundClearanceMm ?? null, input.safetyFeatures ?? null,
      input.variant ?? null, input.description ?? null, input.imageUrl ?? null, input.status ?? 'listed',
    );
    const vehicle = toVehicle(await db.get('SELECT * FROM vehicles WHERE id = ?', id));
    return res.status(201).json({ vehicle });
  });

  app.put('/api/vehicles/:id', requireAuth, requireAdmin, async (req, res) => {
    const input = validate(vehicleSchema, req.body, res);
    if (!input) return;

    if (await db.get("SELECT 1 FROM checkout_orders WHERE vehicle_id = ? AND status IN ('pending', 'processing') LIMIT 1", req.params.id)) {
      return res.status(409).json({ error: 'A customer has an active reservation for this vehicle. Try again after checkout ends.' });
    }

    const result = await db.run(`
      UPDATE vehicles
      SET make = ?, model = ?, category = ?, price = ?, quantity = ?, body_type = ?,
          vehicle_year = ?, fuel_type = ?, transmission = ?, seating_capacity = ?, mileage_kmpl = ?,
          electric_range_km = ?, engine_capacity_cc = ?, ground_clearance_mm = ?, safety_features = ?,
          variant = ?, description = ?, image_url = ?, status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      input.make, input.model, input.category, input.price, input.quantity, input.bodyType ?? null,
      input.year ?? null, input.fuelType ?? null, input.transmission ?? null,
      input.seatingCapacity ?? null, input.mileageKmpl ?? null, input.electricRangeKm ?? null,
      input.engineCapacityCc ?? null, input.groundClearanceMm ?? null, input.safetyFeatures ?? null,
      input.variant ?? null, input.description ?? null, input.imageUrl ?? null, input.status ?? 'listed',
      req.params.id,
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });

    const vehicle = toVehicle(await db.get('SELECT * FROM vehicles WHERE id = ?', req.params.id));
    return res.json({ vehicle });
  });

  app.delete('/api/vehicles/:id', requireAuth, requireAdmin, async (req, res) => {
    const hasCheckouts = await db.get('SELECT 1 FROM checkout_orders WHERE vehicle_id = ? LIMIT 1', req.params.id);
    if (hasCheckouts) {
      return res.status(409).json({ error: 'Vehicle has checkout history and cannot be deleted' });
    }
    const hasPurchases = await db.get('SELECT 1 FROM purchases WHERE vehicle_id = ? LIMIT 1', req.params.id);
    if (hasPurchases) {
      return res.status(409).json({ error: 'Vehicle has purchase history and cannot be deleted' });
    }

    const result = await db.run('DELETE FROM vehicles WHERE id = ?', req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });
    return res.status(204).end();
  });

  async function releaseCheckout(checkoutId, userId) {
    return db.transaction(async (tx) => {
      const checkout = await tx.get(
        "SELECT vehicle_id FROM checkout_orders WHERE id = ? AND user_id = ? AND status = 'pending'",
        checkoutId,
        userId,
      );
      if (!checkout) return false;
      const result = await tx.run(
        "UPDATE checkout_orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'",
        checkoutId,
      );
      if (!result.changes) return false;
      await tx.run('UPDATE vehicles SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', checkout.vehicle_id);
      return true;
    });
  }

  app.post('/api/vehicles/:id/checkout', requireAuth, checkoutLimiter, async (req, res) => {
    const input = validate(checkoutSchema, req.body, res);
    if (!input) return;

    await expireCheckoutOrders(db);
    const checkoutId = randomUUID();
    const now = Date.now();
    const checkout = await db.transaction(async (tx) => {
      const vehicle = await tx.get(
        "SELECT id, make, model, price FROM vehicles WHERE id = ? AND status = 'listed' AND quantity > 0",
        req.params.id,
      );
      if (!vehicle) return null;
      const amountMinor = Math.round(vehicle.price * 100);
      if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) return null;
      const unitPrice = amountMinor / 100;
      const reserved = await tx.run(`
        UPDATE vehicles SET quantity = quantity - 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'listed' AND quantity > 0
      `, vehicle.id);
      if (!reserved.changes) return null;
      await tx.run(`
        INSERT INTO checkout_orders
          (id, vehicle_id, user_id, customer_name, email, phone, delivery_address,
           unit_price, amount_minor, status, payment_method, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `, checkoutId, vehicle.id, req.user.id, input.customerName, input.email, input.phone,
      input.deliveryAddress, unitPrice, amountMinor, input.paymentMethod, now + 24 * 60 * 60 * 1000);
      await tx.run(`
        UPDATE users SET name = ?, phone = ?, delivery_address = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, input.customerName, input.phone, input.deliveryAddress, req.user.id);
      return { ...vehicle, price: unitPrice, paymentMethod: input.paymentMethod };
    });
    if (!checkout) return res.status(409).json({ error: 'This vehicle is no longer available. Please refresh the inventory.' });
    const vehicle = toVehicle(await db.get('SELECT * FROM vehicles WHERE id = ?', checkout.id));
    return res.status(201).json({
      order: {
        id: checkoutId,
        status: 'pending',
        totalAmount: checkout.price,
        paymentMethod: checkout.paymentMethod,
        expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      },
      vehicle,
    });
  });

  app.post('/api/checkout/:id/cancel', requireAuth, async (req, res) => {
    await releaseCheckout(req.params.id, req.user.id);
    return res.status(204).end();
  });


  app.post('/api/vehicles/:id/purchase', requireAuth, (_req, res) => (
    res.status(410).json({ error: 'Direct purchases are disabled. Submit an order through the dealership checkout.' })
  ));

  app.post('/api/vehicles/:id/restock', requireAuth, requireAdmin, async (req, res) => {
    const input = validate(restockSchema, req.body, res);
    if (!input) return;

    const result = await db.run(`
      UPDATE vehicles
      SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND quantity <= 1000000 - ?
    `, input.quantity, req.params.id, input.quantity);
    if (result.changes === 0) {
      const exists = await db.get('SELECT 1 FROM vehicles WHERE id = ?', req.params.id);
      return res.status(exists ? 400 : 404).json({
        error: exists ? 'Restock would exceed the maximum inventory quantity' : 'Vehicle not found',
      });
    }

    const vehicle = toVehicle(await db.get('SELECT * FROM vehicles WHERE id = ?', req.params.id));
    return res.json({ vehicle });
  });

  app.post('/api/enquiries', optionalAuth, enquiryLimiter, async (req, res) => {
    const input = validate(enquirySchema, req.body, res);
    if (!input) return;

    if (input.vehicleId) {
      const vehicle = await db.get("SELECT 1 FROM vehicles WHERE id = ? AND status = 'listed'", input.vehicleId);
      if (!vehicle) return res.status(404).json({ error: 'Selected vehicle is not available' });
    }

    const id = randomUUID();
    try {
      await db.run(`
        INSERT INTO enquiries (
          id, submission_key, user_id, vehicle_id, customer_name, email, phone, subject, message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        id, input.submissionKey, req.user?.id ?? null, input.vehicleId ?? null,
        input.customerName, input.email, input.phone, input.subject, input.message,
      );
    } catch (error) {
      if ((error.code === 'ERR_SQLITE_ERROR'
        && /UNIQUE constraint failed: enquiries\.submission_key/i.test(error.message))
        || (error.code === '23505' && error.constraint === 'enquiries_submission_key_key')) {
        return res.status(409).json({ error: 'This enquiry has already been submitted' });
      }
      throw error;
    }
    return res.status(201).json({ id, status: 'new', message: 'Thank you. Your enquiry has been received.' });
  });

  app.get('/api/admin/dashboard', requireAuth, requireAdmin, async (_req, res) => {
    const inventory = await db.get(`
      SELECT
        COUNT(*) AS "totalVehicles",
        COALESCE(SUM(CASE WHEN quantity > 0 AND status = 'listed' THEN 1 ELSE 0 END), 0) AS "availableVehicles",
        COALESCE(SUM(CASE WHEN quantity = 0 AND status = 'listed' THEN 1 ELSE 0 END), 0) AS "soldVehicles",
        COALESCE(SUM(CASE WHEN status = 'listed' THEN price * quantity ELSE 0 END), 0) AS "inventoryValue"
      FROM vehicles
    `);
    const enquiries = await db.get(`
      SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0) AS pending
      FROM enquiries
    `);
    const groupRows = async (column) => (await db.all(`
      SELECT COALESCE(NULLIF(${column}, ''), 'Not recorded') AS label, COUNT(*) AS count
      FROM vehicles
      WHERE status = 'listed'
      GROUP BY ${column}
      ORDER BY count DESC, label ASC
      LIMIT 8
    `)).map((row) => ({ ...row, count: Number(row.count) }));
    const recentVehicles = (await db.all(`
      SELECT * FROM vehicles ORDER BY updated_at DESC, id ASC LIMIT 5
    `)).map(toVehicle);
    const recentEnquiries = (await db.all(`
      SELECT e.*, v.make AS vehicle_make, v.model AS vehicle_model
      FROM enquiries e LEFT JOIN vehicles v ON v.id = e.vehicle_id
      ORDER BY e.created_at DESC, e.id ASC LIMIT 5
    `)).map(toEnquiry);
    return res.json({
      inventory: Object.fromEntries(Object.entries(inventory).map(([key, value]) => [key, Number(value)])),
      enquiries: Object.fromEntries(Object.entries(enquiries).map(([key, value]) => [key, Number(value)])),
      groups: {
        make: await groupRows('make'),
        bodyType: await groupRows('body_type'),
        fuelType: await groupRows('fuel_type'),
      },
      recentVehicles,
      recentEnquiries,
    });
  });

  app.get('/api/admin/orders', requireAuth, requireAdmin, async (_req, res) => {
    await expireCheckoutOrders(db);
    const orders = await db.all(`
      SELECT c.id, c.status, c.customer_name, c.email, c.phone, c.delivery_address,
             c.unit_price, c.payment_method, c.created_at, c.expires_at,
             v.make, v.model, v.vehicle_year
      FROM checkout_orders c
      JOIN vehicles v ON v.id = c.vehicle_id
      WHERE c.status = 'pending'
      ORDER BY c.created_at DESC, c.id ASC
      LIMIT 50
    `);
    return res.json({ orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      customerName: order.customer_name,
      email: order.email,
      phone: order.phone,
      deliveryAddress: order.delivery_address,
      totalAmount: Number(order.unit_price),
      paymentMethod: order.payment_method,
      createdAt: order.created_at,
      expiresAt: new Date(Number(order.expires_at)).toISOString(),
      vehicle: {
        make: order.make,
        model: order.model,
        year: order.vehicle_year,
      },
    })) });
  });

  app.patch('/api/admin/orders/:id', requireAuth, requireAdmin, async (req, res) => {
    const input = validate(dealershipOrderActionSchema, req.body, res);
    if (!input) return;
    const outcome = await db.transaction(async (tx) => {
      const order = await tx.get(
        "SELECT id, vehicle_id, user_id, unit_price, expires_at FROM checkout_orders WHERE id = ? AND status = 'pending'",
        req.params.id,
      );
      if (!order) return { state: 'not_pending' };
      if (Number(order.expires_at) <= Date.now()) {
        const expired = await tx.run("UPDATE checkout_orders SET status = 'expired' WHERE id = ? AND status = 'pending'", order.id);
        if (!expired.changes) return { state: 'not_pending' };
        await tx.run('UPDATE vehicles SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', order.vehicle_id);
        return { state: 'expired' };
      }
      const updated = await tx.run(
        'UPDATE checkout_orders SET status = ? WHERE id = ? AND status = \'pending\'',
        input.status,
        order.id,
      );
      if (!updated.changes) return { state: 'not_pending' };
      if (input.status === 'paid') {
        const purchaseId = randomUUID();
        await tx.run(`
          INSERT INTO purchases (id, vehicle_id, user_id, quantity, unit_price, total_amount, checkout_order_id)
          VALUES (?, ?, ?, 1, ?, ?, ?)
        `, purchaseId, order.vehicle_id, order.user_id, order.unit_price, order.unit_price, order.id);
        return { state: 'paid', purchaseId };
      }
      await tx.run('UPDATE vehicles SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', order.vehicle_id);
      return { state: 'cancelled' };
    });
    if (outcome.state === 'expired') return res.status(409).json({ error: 'This order reservation has expired.' });
    if (outcome.state === 'not_pending') return res.status(409).json({ error: 'This order is no longer awaiting dealership action.' });
    return res.json({ status: outcome.state, purchaseId: outcome.purchaseId || null });
  });

  app.get('/api/admin/enquiries', requireAuth, requireAdmin, async (req, res) => {
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
      conditions.push("(LOWER(e.customer_name) LIKE LOWER(?) ESCAPE '\\' OR LOWER(e.email) LIKE LOWER(?) ESCAPE '\\' OR LOWER(e.subject) LIKE LOWER(?) ESCAPE '\\')");
      values.push(query, query, query);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = Number((await db.get(`SELECT COUNT(*) AS total FROM enquiries e ${where}`, ...values)).total);
    const rows = await db.all(`
      SELECT e.*, v.make AS vehicle_make, v.model AS vehicle_model
      FROM enquiries e LEFT JOIN vehicles v ON v.id = e.vehicle_id
      ${where}
      ORDER BY e.created_at DESC, e.id ASC LIMIT ? OFFSET ?
    `, ...values, filters.pageSize, (filters.page - 1) * filters.pageSize);
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

  app.get('/api/admin/enquiries/:id', requireAuth, requireAdmin, async (req, res) => {
    const enquiry = await db.get(`
      SELECT e.*, v.make AS vehicle_make, v.model AS vehicle_model
      FROM enquiries e LEFT JOIN vehicles v ON v.id = e.vehicle_id
      WHERE e.id = ?
    `, req.params.id);
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });
    return res.json({ enquiry: toEnquiry(enquiry) });
  });

  app.patch('/api/admin/enquiries/:id', requireAuth, requireAdmin, async (req, res) => {
    const input = validate(enquiryStatusSchema, req.body, res);
    if (!input) return;
    const result = await db.run(`
      UPDATE enquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, input.status, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Enquiry not found' });
    const enquiry = await db.get(`
      SELECT e.*, v.make AS vehicle_make, v.model AS vehicle_model
      FROM enquiries e LEFT JOIN vehicles v ON v.id = e.vehicle_id
      WHERE e.id = ?
    `, req.params.id);
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
