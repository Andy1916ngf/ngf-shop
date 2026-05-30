const admin  = require('firebase-admin');
const axios  = require('axios');
const { queueEmail } = require('./mail');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Kustom API client — same credentials as checkout.js
const kustom = axios.create({
  baseURL: process.env.KUSTOM_API_URL,
  headers: {
    Authorization:  `Basic ${Buffer.from(process.env.KUSTOM_API_KEY).toString('base64')}`,
    'Content-Type': 'application/json',
  },
});

/**
 * HTTP function: receives Kustom push notifications.
 *
 * Kustom calls this URL when a checkout is completed. The order_id is
 * passed as a query parameter (?order_id=...) — there is no HMAC signature.
 *
 * We respond 200 immediately so Kustom doesn't retry, then:
 *   1. Read the full order from Kustom API to get customer details
 *   2. Update the Firestore order document
 *   3. Send a new order notification email to the shop admin
 */
async function handleWebhook(req, res) {
  // Kustom sends order_id as a query parameter
  const orderId = req.query.order_id || req.body?.order_id;

  if (!orderId) {
    console.warn('kustomWebhook: no order_id in request');
    return res.status(200).send('ok (no order_id)');
  }

  const orderRef  = db.doc(`orders/${orderId}`);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    console.warn(`kustomWebhook: unknown order ${orderId}`);
    return res.status(200).send('ok (unknown order)');
  }

  const order = orderSnap.data();

  // Idempotency — if we already have customer details, skip
  if (order.customerEmail) {
    return res.status(200).send('ok (already processed)');
  }

  // Fetch full order from Kustom to get customer details
  try {
    const kustomRes = await kustom.get(`/checkout/v3/orders/${orderId}`);
    const ko   = kustomRes.data;
    const addr = ko.billing_address || {};

    const updates = {
      customerName:  [addr.given_name, addr.family_name].filter(Boolean).join(' ') || null,
      customerEmail: addr.email  || null,
      customerPhone: addr.phone  || null,
      kustomStatus:  ko.status,
      updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
    };

    await orderRef.update(updates);

    // Notify shop admin of new order
    await queueEmail(
      orderId,
      { ...order, ...updates },
      process.env.ADMIN_EMAIL_GROUP,
      'new_order'
    );
  } catch (err) {
    console.error('kustomWebhook: failed to fetch order from Kustom:', err.message);
    // Return 200 regardless — Kustom must not retry indefinitely
  }

  return res.status(200).send('ok');
}

module.exports = { handleWebhook };
