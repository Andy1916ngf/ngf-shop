/**
 * Cloud Functions v2 — all callable functions use the v2 onCall API
 * (Cloud Run under the hood). The adapter pattern below maps v2 request
 * objects to the v1-style (data, context) that each handler expects,
 * so no changes are needed in the individual handler files.
 */

const { onCall, onRequest } = require('firebase-functions/v2/https');

const { getProducts, updateProduct,
        deleteProduct, getProductImageUploadUrl,
        getProducts_admin }                       = require('./products');
const { createOrder, readOrder }                  = require('./checkout');
const { captureOrder, markShipped,
        markDelivered, cancelOrder }              = require('./orders');
const { checkCoupon }                             = require('./coupons');
const { handleWebhook }                           = require('./webhook');
const { getRole }                                 = require('./auth');
const { updateContent, updateConfig,
        getAdminConfig }                          = require('./content');

// Shared options for all functions
const opts = {
  region:      'europe-west1',
  memory:      '256MiB',
  timeoutSeconds: 60,
  maxInstances: 10,
};

// Adapter: maps v2 CallableRequest → v1-style handler(data, context)
// This keeps all handler files unchanged.
function callable(fn, extraOpts = {}) {
  return onCall({ ...opts, ...extraOpts }, (request) =>
    fn(request.data, { auth: request.auth, app: request.app })
  );
}

// ── Public shop ───────────────────────────────────────────────
exports.getProducts  = callable(getProducts);
exports.createOrder  = callable(createOrder);
exports.readOrder    = callable(readOrder);
exports.checkCoupon  = callable(checkCoupon);

// ── Webhook (HTTP, not callable) ──────────────────────────────
exports.kustomWebhook = onRequest(opts, handleWebhook);

// ── Auth ──────────────────────────────────────────────────────
exports.getRole      = callable(getRole);

// ── Admin — orders ────────────────────────────────────────────
exports.captureOrder   = callable(captureOrder);
exports.markShipped    = callable(markShipped);
exports.markDelivered  = callable(markDelivered);
exports.cancelOrder    = callable(cancelOrder);

// ── Admin — products ──────────────────────────────────────────
exports.getProducts_admin       = callable(getProducts_admin);
exports.updateProduct           = callable(updateProduct);
exports.deleteProduct           = callable(deleteProduct);
exports.getProductImageUploadUrl = callable(getProductImageUploadUrl);

// ── Admin — content / config ──────────────────────────────────
exports.updateContent  = callable(updateContent);
exports.updateConfig   = callable(updateConfig);
exports.getAdminConfig = callable(getAdminConfig);
