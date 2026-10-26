const { createHmac, timingSafeEqual } = require('node:crypto');

function paymentConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID
    && process.env.RAZORPAY_KEY_SECRET
    && process.env.RAZORPAY_WEBHOOK_SECRET);
}

async function razorpayRequest(path, options = {}) {
  const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${credentials}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.description || 'Payment provider request failed');
    error.status = response.status;
    throw error;
  }
  return body;
}

function isValidSignature(payload, secret, received) {
  if (!secret || typeof received !== 'string' || !Buffer.isBuffer(payload)) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(received, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isValidPaymentSignature(orderId, paymentId, signature) {
  if (typeof signature !== 'string') return false;
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function expireCheckoutOrders(db) {
  const now = Date.now();
  return db.transaction(async (tx) => {
    const expired = await tx.all(
      "SELECT id, vehicle_id FROM checkout_orders WHERE status = 'pending' AND expires_at <= ?",
      now,
    );
    for (const order of expired) {
      const result = await tx.run(
        "UPDATE checkout_orders SET status = 'expired' WHERE id = ? AND status = 'pending'",
        order.id,
      );
      if (result.changes) {
        await tx.run('UPDATE vehicles SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', order.vehicle_id);
      }
    }
    return expired.length;
  });
}

module.exports = {
  expireCheckoutOrders,
  isValidPaymentSignature,
  isValidSignature,
  paymentConfigured,
  razorpayRequest,
};
