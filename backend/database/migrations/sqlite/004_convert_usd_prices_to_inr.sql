-- Convert inventory and purchase amounts using USD/INR 95.001468, updated 2026-10-25 UTC.
-- Source: https://open.er-api.com/v6/latest/USD
UPDATE vehicles
SET price = ROUND(price * 95.001468, 2),
    updated_at = datetime('now');

UPDATE purchases
SET unit_price = ROUND(unit_price * 95.001468, 2),
    total_amount = ROUND(total_amount * 95.001468, 2);
