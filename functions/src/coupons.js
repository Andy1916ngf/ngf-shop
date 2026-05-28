const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Callable (public): validate a coupon code and return the discount amount.
 * This function has NO side effects — it does not increment timesUsed.
 * That happens in createOrder when the order is actually placed.
 *
 * Used by the basket page to show real-time feedback before checkout.
 *
 * data: { code: string, subtotalInOre: number }
 * Returns: { valid: boolean, discount?: number, reason?: string }
 *
 * The subtotalInOre is provided by the client for UI calculation only.
 * The authoritative discount is always recalculated server-side in createOrder.
 */
async function checkCoupon(data) {
  const { code, subtotalInOre = 0 } = data;
  if (!code) return { valid: false, reason: 'missing_code' };

  const snap = await db.doc(`coupons/${code.trim().toUpperCase()}`).get();
  const c = snap.data();
  const now = new Date();

  if (!c || !c.active)                          return { valid: false, reason: 'invalid' };
  if (c.validFrom?.toDate()   > now)            return { valid: false, reason: 'not_yet_valid' };
  if (c.validUntil?.toDate()  < now)            return { valid: false, reason: 'expired' };
  if (c.usageLimit && c.timesUsed >= c.usageLimit) return { valid: false, reason: 'exhausted' };

  const discount = c.type === 'percent'
    ? Math.round(subtotalInOre * c.value / 100)
    : c.value;

  return {
    valid:    true,
    discount,           // öre
    type:     c.type,
    value:    c.value,
  };
}

module.exports = { checkCoupon };
