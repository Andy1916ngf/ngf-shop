const admin = require('firebase-admin');
const { verifyAdmin } = require('./auth');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const ALLOWED_PAGES = ['about', 'tac', 'faq'];

/**
 * Callable (siteAdmin): save rich-text content for a static page.
 * data: { pageId: 'about'|'tac'|'faq', title: string, body: string (HTML from Quill) }
 */
async function updateContent(data, context) {
  await verifyAdmin(context, 'siteAdmin');
  const { pageId, title, body } = data;

  if (!ALLOWED_PAGES.includes(pageId)) {
    throw new Error(`invalid pageId: ${pageId}. Allowed: ${ALLOWED_PAGES.join(', ')}`);
  }

  await db.doc(`content/${pageId}`).set(
    { title, body, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { success: true };
}

/**
 * Callable (siteAdmin): update site config.
 * data: { config: { shopName?, currency?, maintenanceMode?, hero? } }
 */
async function updateConfig(data, context) {
  await verifyAdmin(context, 'siteAdmin');
  await db.doc('config/site').set(data.config, { merge: true });
  return { success: true };
}

/**
 * Callable (shopAdmin+): read site config for the admin panel.
 */
async function getAdminConfig(data, context) {
  await verifyAdmin(context, 'shopAdmin');
  const snap = await db.doc('config/site').get();
  return snap.data() || {};
}

module.exports = { updateContent, updateConfig, getAdminConfig };
