ALTER TABLE purchases ADD COLUMN checkout_order_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_checkout_order ON purchases(checkout_order_id);
