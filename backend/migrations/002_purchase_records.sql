CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price > 0),
  total_amount REAL NOT NULL CHECK (total_amount > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_purchases_user_created ON purchases(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_vehicle ON purchases(vehicle_id);
