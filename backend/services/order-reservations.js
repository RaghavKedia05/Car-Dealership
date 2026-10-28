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

module.exports = { expireCheckoutOrders };
