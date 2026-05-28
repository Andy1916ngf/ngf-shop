const admin = require('firebase-admin');
const { verifyAdmin } = require('./auth');

if (!admin.apps.length) admin.initializeApp();
const db      = admin.firestore();
const storage = admin.storage();

/**
 * Callable (public): return all visible products for the shop catalog.
 */
async function getProducts() {
  const snap = await db.collection('products')
    .where('visible', '==', true)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Callable (shopAdmin): return all products including hidden ones for the admin panel.
 */
async function getAllProducts(data, context) {
  await verifyAdmin(context, 'shopAdmin');
  const snap = await db.collection('products').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Callable (siteAdmin): create or update a product.
 * data: {
 *   productId?: string  (omit for new products)
 *   isNew: boolean
 *   name, description, price (öre), category, stock, visible, images, variations
 * }
 */
async function updateProduct(data, context) {
  await verifyAdmin(context, 'siteAdmin');
  const { productId, isNew, ...fields } = data;

  if (!Number.isInteger(fields.price) || fields.price <= 0) {
    throw new Error('price must be a positive integer in öre (e.g. 44900 = 449 kr)');
  }

  const ref = isNew
    ? db.collection('products').doc()
    : db.doc(`products/${productId}`);

  await ref.set(
    {
      ...fields,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(isNew && { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
    },
    { merge: !isNew }
  );

  return { id: ref.id };
}

/**
 * Callable (siteAdmin): soft-delete a product (set visible: false).
 * Hard deletes are intentionally not provided — historical order lines reference product data.
 * data: { productId }
 */
async function deleteProduct(data, context) {
  await verifyAdmin(context, 'siteAdmin');
  const { productId } = data;
  await db.doc(`products/${productId}`).update({
    visible:   false,
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
}

/**
 * Callable (siteAdmin): return a short-lived signed URL for uploading a product image.
 * The frontend uploads the file directly to Firebase Storage using this URL,
 * then stores the returned publicUrl in the product document.
 * data: { filename, contentType }
 */
async function getProductImageUploadUrl(data, context) {
  await verifyAdmin(context, 'siteAdmin');
  const { filename, contentType } = data;

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(contentType)) {
    throw new Error(`unsupported image type: ${contentType}`);
  }

  // Sanitise filename
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
  const filePath = `products/${Date.now()}_${safeName}`;
  const file     = storage.bucket().file(filePath);

  const [signedUrl] = await file.getSignedUrl({
    action:      'write',
    expires:     Date.now() + 15 * 60 * 1000, // 15-minute upload window
    contentType,
  });

  const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${filePath}`;

  return { uploadUrl: signedUrl, publicUrl, filePath };
}

module.exports = {
  getProducts,
  getAllProducts,
  updateProduct,
  deleteProduct,
  getProductImageUploadUrl,
};
