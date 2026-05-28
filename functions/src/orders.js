const admin  = require('firebase-admin');
const axios  = require('axios');
const { verifyAdmin } = require('./auth');
const { queueEmail }  = require('./mail');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const kustom = axios.create({
  baseURL: process.env.KUSTOM_API_URL,
  headers: {
    Authorization:  `Basic ${process.env.KUSTOM_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Callable (shopAdmin): confirm an order → triggers Kustom capture.
 * Status transition: beställd → bekräftad
 * data: { orderId, adminNote? }
 */
async function captureOrder(data, context) {
  await verifyAdmin(context, 'shopAdmin');
  const { orderId, adminNote } = data;

  const snap  = await db.doc(`orders/${orderId}`).get();
  const order = snap.data();
  if (!order) throw new Error('order not found');
  if (order.status !== 'beställd') throw new Error('order is not in beställd state');

  await kustom.post(
    `/ordermanagement/v1/orders/${orderId}/captures`,
    {
      captured_amount: order.totalAmount,
      order_lines: order.items.map(i => ({
        type:             'physical',
        reference:        i.productId,
        name:             i.name,
        quantity:         i.quantity,
        quantity_unit:    'pcs',
        unit_price:       i.unitPrice,
        tax_rate:         2500,
        total_amount:     i.unitPrice * i.quantity,
        total_tax_amount: Math.round((i.unitPrice * i.quantity) - (i.unitPrice * i.quantity) / 1.25),
      })),
    },
    { headers: { 'Klarna-Idempotency-Key': `capture-${orderId}` } }
  );

  await db.doc(`orders/${orderId}`).update({
    status:       'bekräftad',
    kustomStatus: 'captured',
    adminNote:    adminNote || null,
    confirmedAt:  admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
  });

  if (order.customerEmail) {
    await queueEmail(orderId, { ...order, adminNote }, order.customerEmail, 'confirmed');
  }
  return { success: true };
}

/**
 * Callable (shopAdmin): mark an order as shipped.
 * Status transition: bekräftad → skickad
 * data: { orderId, adminNote? }
 */
async function markShipped(data, context) {
  await verifyAdmin(context, 'shopAdmin');
  const { orderId, adminNote } = data;

  const snap  = await db.doc(`orders/${orderId}`).get();
  const order = snap.data();
  if (!order) throw new Error('order not found');
  if (order.status !== 'bekräftad') throw new Error('order is not in bekräftad state');

  await db.doc(`orders/${orderId}`).update({
    status:    'skickad',
    adminNote: adminNote || null,
    shippedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (order.customerEmail) {
    await queueEmail(orderId, { ...order, adminNote }, order.customerEmail, 'shipped');
  }
  return { success: true };
}

/**
 * Callable (shopAdmin): mark an order as delivered.
 * Status transition: skickad → levererad
 * data: { orderId }
 */
async function markDelivered(data, context) {
  await verifyAdmin(context, 'shopAdmin');
  const { orderId } = data;

  const snap  = await db.doc(`orders/${orderId}`).get();
  const order = snap.data();
  if (!order) throw new Error('order not found');

  await db.doc(`orders/${orderId}`).update({
    status:      'levererad',
    deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
}

/**
 * Callable (shopAdmin): cancel an order.
 * - If beställd (authorized): release the Kustom authorisation
 * - If bekräftad/skickad (captured): issue a full refund via Kustom
 * data: { orderId }
 */
async function cancelOrder(data, context) {
  await verifyAdmin(context, 'shopAdmin');
  const { orderId } = data;

  const snap  = await db.doc(`orders/${orderId}`).get();
  const order = snap.data();
  if (!order) throw new Error('order not found');
  if (['levererad', 'avbruten'].includes(order.status)) {
    throw new Error('order cannot be cancelled in its current state');
  }

  let newKustomStatus;

  if (order.kustomStatus === 'authorized') {
    // Release the reservation — customer is not charged
    await kustom.post(`/ordermanagement/v1/orders/${orderId}/cancel`);
    newKustomStatus = 'cancelled';
  } else if (order.kustomStatus === 'captured') {
    // Full refund
    const capturesRes = await kustom.get(`/ordermanagement/v1/orders/${orderId}/captures`);
    const captures = capturesRes.data.captures || [];
    for (const capture of captures) {
      await kustom.post(`/ordermanagement/v1/orders/${orderId}/refunds`, {
        refunded_amount: capture.captured_amount,
        order_lines:     capture.order_lines,
      });
    }
    newKustomStatus = 'refunded';
  }

  await db.doc(`orders/${orderId}`).update({
    status:       'avbruten',
    kustomStatus: newKustomStatus,
    cancelledAt:  admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
  });

  if (order.customerEmail) {
    await queueEmail(orderId, order, order.customerEmail, 'cancelled');
  }
  return { success: true };
}

module.exports = { captureOrder, markShipped, markDelivered, cancelOrder };
