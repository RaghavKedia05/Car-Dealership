ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'disabled'));
ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
UPDATE users SET updated_at = created_at WHERE updated_at = '1970-01-01 00:00:00';

ALTER TABLE vehicles ADD COLUMN variant TEXT;
ALTER TABLE vehicles ADD COLUMN description TEXT;
ALTER TABLE vehicles ADD COLUMN image_url TEXT;
ALTER TABLE vehicles ADD COLUMN status TEXT NOT NULL DEFAULT 'listed'
  CHECK (status IN ('listed', 'unlisted'));

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
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'in_progress', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status_created ON enquiries(status, created_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_vehicle ON enquiries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_user_created ON enquiries(user_id, created_at);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  token_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
