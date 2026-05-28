const admin = require('firebase-admin');
const axios  = require('axios');

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
 * Callable: create a Kustom order from a basket.
 *
 * data: {
 *   items: [{ productId, quantity, selectedVariations? }],
 *   couponCode?: string,
 *   deliveryMethod?: 'pickup' | 'delivery'   default 'pickup'
 * }
 *
 * Prices and shipping costs are ALWAYS fetched from Firestore — client values are ignored.
 */
async function createOrder(data, context) {
  const { items, couponCode, deliveryMethod = 'pickup' } = data;
  if (!items || items.length === 0) throw new Error('empty basket');

  // Fetch authoritative product data from Firestore
  const productSnaps = await Promise.all(
    items.map(i => db.doc(`products/${i.productId}`).get())
  );

  // Build Kustom order lines
  const orderLines = items.map((item, idx) => {
    const p = productSnaps[idx].data();
    if (!p || !p.visible) throw new Error(`product ${item.productId} unavailable`);

    // Append variation details to the line item name for clarity on the receipt
    const varParts = item.selectedVariations
      ? Object.values(item.selectedVariations).filter(Boolean)
      : [];
    const name  = varParts.length ? `${p.name} (${varParts.join(', ')})` : p.name;
    const total = p.price * item.quantity;

    return {
      type:             'physical',
      reference:        item.productId,
      name,
      quantity:         item.quantity,
      quantity_unit:    'pcs',
      unit_price:       p.price,                                           // öre
      tax_rate:         2500,                                              // 25% Swedish VAT
      total_amount:     total,
      total_tax_amount: Math.round(total - total / 1.25),
    };
  });

  // Validate and apply coupon server-side
  let discount = 0;
  if (couponCode) {
    const couponSnap = await db.doc(`coupons/${couponCode.toUpperCase()}`).get();
    const c = couponSnap.data();
    const now = new Date();
    const validFrom  = c?.validFrom?.toDate();
    const validUntil = c?.validUntil?.toDate();
    const withinDates = (!validFrom || validFrom <= now) && (!validUntil || validUntil >= now);
    const withinLimit = !c?.usageLimit || c.timesUsed < c.usageLimit;

    if (c && c.active && withinDates && withinLimit) {
      const subtotal = orderLines.reduce((s, l) => s + l.total_amount, 0);
      discount = c.type === 'percent'
        ? Math.round(subtotal * c.value / 100)
        : c.value;
    }
    // If invalid, silently proceed at full price (UI should pre-validate)
  }

  const subtotal = orderLines.reduce((s, l) => s + l.total_amount, 0);

  // ── Shipping ─────────────────────────────────────────────
  // Default: free pick-up. If deliveryMethod === 'delivery' and
  // shippingEnabled is true in config, calculate cost from shippingRules.
  let shippingCost = 0;
  let shippingRef  = 'pickup';
  let shippingName = 'Upphämtning vid träning (gratis)';

  if (deliveryMethod === 'delivery') {
    const configSnap = await db.doc('config/site').get();
    const config     = configSnap.data() || {};

    if (config.shippingEnabled && config.shippingRules?.length) {
      // Sum shippingSize × quantity across all items
      const totalUnits = items.reduce((sum, item, idx) => {
        const p = productSnaps[idx].data();
        return sum + ((p.shippingSize || 1) * item.quantity);
      }, 0);

      // Find first rule where totalUnits ≤ maxUnits; fall back to last rule
      const sorted = [...config.shippingRules].sort((a, b) => a.maxUnits - b.maxUnits);
      const rule   = sorted.find(r => totalUnits <= r.maxUnits) ?? sorted[sorted.length - 1];

      if (rule) {
        shippingCost = rule.costInOre;
        shippingRef  = 'delivery';
        shippingName = 'Hemleverans';
      }
    }
    // shippingEnabled = false → silently fall back to free pick-up
  }

  const orderAmount = subtotal - discount + shippingCost;

  // Add discount line if applicable
  if (discount > 0) {
    orderLines.push({
      type:             'discount',
      reference:        couponCode,
      name:             `Rabattkod: ${couponCode}`,
      quantity:         1,
      quantity_unit:    'pcs',
      unit_price:       -discount,
      tax_rate:         0,
      total_amount:     -discount,
      total_tax_amount: 0,
    });
  }

  const shippingLine = {
    type:             'shipping_fee',
    reference:        shippingRef,
    name:             shippingName,
    quantity:         1,
    quantity_unit:    'pcs',
    unit_price:       shippingCost,
    tax_rate:         0,
    total_amount:     shippingCost,
    total_tax_amount: 0,
  };

  // Build Kustom payload
  const functionsUrl = process.env.GCLOUD_PROJECT
    ? `https://europe-north1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net`
    : 'REPLACE_ME_FUNCTIONS_BASE_URL';

  const payload = {
    purchase_country:  'SE',
    purchase_currency: 'SEK',
    locale:            'sv-SE',
    order_amount:      orderAmount,
    order_tax_amount:  orderLines
      .filter(l => l.tax_rate > 0)
      .reduce((s, l) => s + l.total_tax_amount, 0),
    order_lines: [...orderLines, shippingLine],
    merchant_urls: {
      terms:        `${process.env.SHOP_DOMAIN}/villkor`,
      checkout:     `${process.env.SHOP_DOMAIN}/checkout`,
      confirmation: `${process.env.SHOP_DOMAIN}/confirmation?order_id={checkout.order.id}`,
      push:         `${functionsUrl}/kustomWebhook`,
    },
  };

  // Call Kustom API
  const res = await kustom.post('/payments/v1/authorizations/', payload);
  const kustomOrder = res.data;

  // Persist order to Firestore
  await db.doc(`orders/${kustomOrder.order_id}`).set({
    kustomOrderId:   kustomOrder.order_id,
    status:          'beställd',
    kustomStatus:    'authorized',
    customerEmail:   null,   // populated from Kustom confirmation callback
    customerName:    null,
    items: items.map((item, idx) => ({
      productId:          item.productId,
      name:               productSnaps[idx].data().name,
      quantity:           item.quantity,
      unitPrice:          productSnaps[idx].data().price,
      selectedVariations: item.selectedVariations || null,
    })),
    totalAmount:    orderAmount,
    currency:       'SEK',
    couponCode:     couponCode || null,
    discountAmount: discount,
    deliveryMethod: deliveryMethod,
    shippingCost:   shippingCost,
    adminNote:      null,
    createdAt:      admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
  });

  // Increment coupon usage counter
  if (couponCode && discount > 0) {
    await db.doc(`coupons/${couponCode.toUpperCase()}`).update({
      timesUsed: admin.firestore.FieldValue.increment(1),
    });
  }

  return { html_snippet: kustomOrder.html_snippet };
}

/**
 * Callable: fetch the Kustom confirmation snippet after payment completes.
 * data: { orderId: string }
 */
/**
 * Callable (public): fetch a placed order from Firestore by Kustom order ID.
 *
 * The orderId comes from the URL param ?order_id=... that Kustom appends
 * to the confirmation redirect. Since it is a Kustom-generated UUID it is
 * not guessable, so no additional auth is required for the confirmation page.
 *
 * data: { orderId: string }
 */
async function readOrder(data) {
  const { orderId } = data;
  if (!orderId) throw new Error('missing orderId');

  const snap = await db.doc(`orders/${orderId}`).get();
  if (!snap.exists) throw new Error('order not found');

  const order = snap.data();
  return {
    orderId:        orderId,
    status:         order.status,
    items:          order.items,
    totalAmount:    order.totalAmount,
    currency:       order.currency,
    deliveryMethod: order.deliveryMethod,
    shippingCost:   order.shippingCost,
    discountAmount: order.discountAmount,
    couponCode:     order.couponCode     || null,
    customerName:   order.customerName   || null,
    createdAt:      order.createdAt?.toMillis?.() || null,
  };
}

module.exports = { createOrder, readOrder };
