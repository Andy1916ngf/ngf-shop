require('dotenv').config();
const functions = require('firebase-functions');

const { createOrder, readOrder }             = require('./checkout');
const { handleWebhook }                      = require('./webhook');
const { captureOrder, markShipped, markDelivered, cancelOrder } = require('./orders');
const { verifyAdmin, getRole }               = require('./auth');
const { getProducts, updateProduct, deleteProduct, getProductImageUploadUrl } = require('./products');
const { updateContent, updateConfig, getAdminConfig } = require('./content');

const region      = 'europe-west1';
const runtimeOpts = { maxInstances: 10 }; // cost guardrail — prevents runaway billing

const { checkCoupon }                                = require('./coupons');

// ── Public shop ───────────────────────────────────────────────
exports.getProducts  = functions.region(region).runWith(runtimeOpts).https.onCall(getProducts);
exports.createOrder  = functions.region(region).runWith(runtimeOpts).https.onCall(createOrder);
exports.readOrder    = functions.region(region).runWith(runtimeOpts).https.onCall(readOrder);
exports.checkCoupon  = functions.region(region).runWith(runtimeOpts).https.onCall(checkCoupon);

// ── Kustom webhook (HTTP, not onCall) ─────────────────────────
exports.kustomWebhook = functions.region(region).runWith(runtimeOpts).https.onRequest(handleWebhook);

// ── Admin: authentication ─────────────────────────────────────
exports.getRole       = functions.region(region).runWith(runtimeOpts).https.onCall(getRole);

// ── Admin: order management ───────────────────────────────────
exports.captureOrder    = functions.region(region).runWith(runtimeOpts).https.onCall(captureOrder);
exports.markShipped     = functions.region(region).runWith(runtimeOpts).https.onCall(markShipped);
exports.markDelivered   = functions.region(region).runWith(runtimeOpts).https.onCall(markDelivered);
exports.cancelOrder     = functions.region(region).runWith(runtimeOpts).https.onCall(cancelOrder);

// ── Admin: product management ─────────────────────────────────
exports.getProducts_admin        = functions.region(region).runWith(runtimeOpts).https.onCall(
  (data, ctx) => { /* wrap to include hidden products for admin */ return require('./products').getAllProducts(data, ctx); }
);
exports.updateProduct            = functions.region(region).runWith(runtimeOpts).https.onCall(updateProduct);
exports.deleteProduct            = functions.region(region).runWith(runtimeOpts).https.onCall(deleteProduct);
exports.getProductImageUploadUrl = functions.region(region).runWith(runtimeOpts).https.onCall(getProductImageUploadUrl);

// ── Admin: content and config ─────────────────────────────────
exports.updateContent  = functions.region(region).runWith(runtimeOpts).https.onCall(updateContent);
exports.updateConfig   = functions.region(region).runWith(runtimeOpts).https.onCall(updateConfig);
exports.getAdminConfig = functions.region(region).runWith(runtimeOpts).https.onCall(getAdminConfig);
