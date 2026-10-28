ALTER TABLE checkout_orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'dealership';
UPDATE checkout_orders
SET payment_method = 'legacy_online'
WHERE razorpay_order_id IS NOT NULL OR razorpay_payment_id IS NOT NULL;
