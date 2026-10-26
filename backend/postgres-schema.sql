CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL CHECK (price > 0),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  body_type TEXT,
  vehicle_year INTEGER CHECK (vehicle_year IS NULL OR vehicle_year BETWEEN 1886 AND 2100),
  fuel_type TEXT CHECK (fuel_type IS NULL OR fuel_type IN ('petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg')),
  transmission TEXT CHECK (transmission IS NULL OR transmission IN ('automatic', 'manual')),
  seating_capacity INTEGER CHECK (seating_capacity IS NULL OR seating_capacity BETWEEN 1 AND 20),
  mileage_kmpl DOUBLE PRECISION CHECK (mileage_kmpl IS NULL OR mileage_kmpl > 0),
  electric_range_km DOUBLE PRECISION CHECK (electric_range_km IS NULL OR electric_range_km > 0),
  engine_capacity_cc INTEGER CHECK (engine_capacity_cc IS NULL OR engine_capacity_cc > 0),
  ground_clearance_mm INTEGER CHECK (ground_clearance_mm IS NULL OR ground_clearance_mm > 0),
  safety_features TEXT,
  variant TEXT,
  description TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'listed' CHECK (status IN ('listed', 'unlisted'))
);

CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles(make);
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(category);
CREATE INDEX IF NOT EXISTS idx_vehicles_price ON vehicles(price);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DOUBLE PRECISION NOT NULL CHECK (unit_price > 0),
  total_amount DOUBLE PRECISION NOT NULL CHECK (total_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_user_created ON purchases(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_vehicle ON purchases(vehicle_id);

CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  submission_key TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status_created ON enquiries(status, created_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_vehicle ON enquiries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_user_created ON enquiries(user_id, created_at);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  token_id TEXT PRIMARY KEY,
  expires_at BIGINT NOT NULL
);
