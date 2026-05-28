/**
 * auth.js — role management via Firestore (config/adminRoles)
 *
 * Admin emails are stored in two arrays in Firestore:
 *   config/adminRoles.siteAdmins  — full access
 *   config/adminRoles.shopAdmins  — orders + products only
 *
 * To add or remove admins: use the Settings page in the admin panel,
 * or edit config/adminRoles directly in the Firebase Console.
 *
 * No Google Workspace Groups or domain-wide delegation required.
 * Any Google account can be an admin — access is controlled by the
 * email lists in Firestore, not by domain.
 */

const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Callable: check if the signed-in user is in the admin lists,
 * set an ngfRole custom claim, and return the role.
 *
 * Called by Login.jsx immediately after Google sign-in.
 * Returns: { role: 'siteAdmin' | 'shopAdmin' | null }
 */
async function getRole(data, context) {
  if (!context.auth) return { role: null };

  const { uid, token } = context.auth;
  const email = (token.email || '').toLowerCase().trim();
  if (!email) return { role: null };

  // Read admin lists from Firestore (Admin SDK bypasses security rules)
  const snap  = await db.doc('config/adminRoles').get();
  const lists = snap.data() || {};

  const siteAdmins = (lists.siteAdmins || []).map(e => e.toLowerCase().trim());
  const shopAdmins = (lists.shopAdmins || []).map(e => e.toLowerCase().trim());

  let role = null;
  if (siteAdmins.includes(email))      role = 'siteAdmin';
  else if (shopAdmins.includes(email)) role = 'shopAdmin';

  await admin.auth().setCustomUserClaims(uid, { ngfRole: role });
  return { role };
}

/**
 * Verify the caller has the required role from their JWT custom claim.
 * Reads from the token — no database call.
 *
 * Call at the top of every admin Cloud Function handler.
 */
async function verifyAdmin(context, requiredRole = 'shopAdmin') {
  if (!context.auth) throw new Error('unauthenticated');

  const { ngfRole } = context.auth.token;

  if (!ngfRole) {
    throw new Error('forbidden: no role assigned');
  }
  if (requiredRole === 'siteAdmin' && ngfRole !== 'siteAdmin') {
    throw new Error('forbidden: siteAdmin required');
  }
  if (requiredRole === 'shopAdmin'
      && ngfRole !== 'siteAdmin'
      && ngfRole !== 'shopAdmin') {
    throw new Error('forbidden: shopAdmin required');
  }

  return ngfRole;
}

module.exports = { verifyAdmin, getRole };