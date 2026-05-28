const admin      = require('firebase-admin');
const axios      = require('axios');
const { Webhook } = require('svix');
const { queueEmail } = require('./mail');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SHOP_EMAIL = process.env.SHOP_EMAIL;

const kustom = axios.create({
  baseURL: process.env.KUSTOM_API_URL,
  headers: {
    Authorization:  `Basic ${process.env.KUSTOM_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * HTTP function: receives Kustom webhook events.
 * Register this URL in Kustom Portal → Settings → Webhooks.
 * Subscribe to: order.created, capture.created, refund.created,
 *               dispute.created, dispute.updated
 */
async function handleWebhook(req, res) {
  // 1. Verify signature
  const wh = new Webhook(process.env.KUSTOM_WEBHOOK_SECRET);
  let event;
  try {
    event = wh.verify(JSON.stringify(req.body), {
      'webhook-id':        req.headers['webhook-id'],
      'webhook-timestamp': req.headers['webhook-timestamp'],
      'webhook-signature': req.headers['webhook-signature'],
    });
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send('invalid signature');
  }

  const { id: eventId, type, data } = event;
  const orderId = data.order_id;
  if (!orderId) return res.status(200).send('ok (no order_id)');

  // 2. Idempotency check
  const eventRef = db.doc(`orders/${orderId}/events/${eventId}`);
  if ((await eventRef.get()).exists) return res.status(200).send('ok (duplicate)');

  // 3. Store raw event
  await eventRef.set({
    eventId,
    type,
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    payload:    data,
  });

  // 4. Fetch existing order
  const orderRef  = db.doc(`orders/${orderId}`);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return res.status(200).send('ok (unknown order)');
  const order   = orderSnap.data();
  const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

  // 5. Handle event types
  if (type === 'order.created') {
    updates.kustomStatus = 'authorized';

    // Fetch full order from Kustom to get customer details
    // (webhook payload is intentionally slim — identifiers only)
    try {
      const kustomOrderRes = await kustom.get(`/payments/v1/authorizations/${orderId}`);
      const ko = kustomOrderRes.data;
      const addr = ko.billing_address || {};
      updates.customerName  = [addr.given_name, addr.family_name].filter(Boolean).join(' ') || null;
      updates.customerEmail = addr.email || null;
      updates.customerPhone = addr.phone || null;
    } catch (err) {
      console.error('Failed to fetch Kustom order for customer data:', err.message);
      // Non-fatal — order is still stored, customer data can be fetched later
    }

    // Notify shop admin group that a new order needs confirmation
    await queueEmail(orderId, { ...order, ...updates }, SHOP_EMAIL, 'new_order');
  }

  if (type === 'capture.created') {
    updates.kustomStatus = 'captured';
    updates.capturedAt   = admin.firestore.FieldValue.serverTimestamp();
  }

  if (type === 'refund.created') {
    updates.kustomStatus = 'refunded';
  }

  if (type === 'dispute.created' || type === 'dispute.updated') {
    updates.status = 'tvist';
    await queueEmail(orderId, order, SHOP_EMAIL, 'dispute');
  }

  await orderRef.update(updates);
  return res.status(200).send('ok');
}

module.exports = { handleWebhook };
