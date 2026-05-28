const admin   = require('firebase-admin');
const { google } = require('googleapis');

if (!admin.apps.length) admin.initializeApp();

const SITE_ADMIN_GROUP = process.env.GOOGLE_GROUPS_SITE_ADMIN;
const SHOP_ADMIN_GROUP = process.env.GOOGLE_GROUPS_SHOP_ADMIN;
const ADMIN_EMAIL      = process.env.GOOGLE_ADMIN_EMAIL; // Workspace admin to impersonate

/**
 * Check if an email address is a member of a Google Workspace Group.
 * Requires the Cloud Function service account to have domain-wide delegation
 * with scope: https://www.googleapis.com/auth/admin.directory.group.member.readonly
 *
 * Setup (one-time):
 *   1. GCP Console → IAM → Service Accounts → find the Firebase Admin SDK account
 *   2. Enable "Domain-wide Delegation" on that service account
 *   3. Copy the Client ID
 *   4. Google Workspace Admin Console → Security → API Controls →
 *      Domain-wide Delegation → Add new → paste Client ID → add scope:
 *      https://www.googleapis.com/auth/admin.directory.group.member.readonly
 *   5. Create groups: shop-site-admins@ and shop-admins@ in Workspace Admin
 */
async function isMemberOfGroup(userEmail, groupEmail) {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/admin.directory.group.member.readonly'],
  });
  const client = await auth.getClient();
  client.subject = ADMIN_EMAIL; // domain-wide delegation impersonation

  const directory = google.admin({ version: 'directory_v1', auth: client });

  try {
    const res = await directory.members.hasMember({
      groupKey:  groupEmail,
      memberKey: userEmail,
    });
    return res.data.isMember === true;
  } catch (err) {
    if (err.status === 404) return false; // not a member — not an error
    console.error(`Group membership check failed for ${userEmail} in ${groupEmail}:`, err.message);
    return false;
  }
}

/**
 * Callable: check Google Workspace group membership, derive role,
 * and set a Firebase custom claim so Firestore rules can verify it.
 *
 * Returns: { role: 'siteAdmin' | 'shopAdmin' | null }
 *
 * The custom claim (ngfRole) is set on the Firebase Auth user record.
 * The frontend must call user.getIdToken(true) after this to refresh
 * the token and pick up the new claim.
 */
async function getRole(data, context) {
  if (!context.auth) return { role: null };

  const { uid, token } = context.auth;
  const email = token.email || '';

  if (!email.endsWith('@nynashamnsgf.se')) {
    await admin.auth().setCustomUserClaims(uid, { ngfRole: null });
    return { role: null };
  }

  const isSite = await isMemberOfGroup(email, SITE_ADMIN_GROUP);
  const isShop = isSite || await isMemberOfGroup(email, SHOP_ADMIN_GROUP);

  const role = isSite ? 'siteAdmin' : (isShop ? 'shopAdmin' : null);

  // Persist role as a custom claim — Firestore rules read this from the JWT
  await admin.auth().setCustomUserClaims(uid, { ngfRole: role });

  return { role };
}

/**
 * Verify the caller has the required role, using the custom claim in their token.
 * This is fast — it reads from the JWT, not from any database.
 *
 * Call this at the top of every admin Cloud Function.
 */
async function verifyAdmin(context, requiredRole = 'shopAdmin') {
  if (!context.auth) throw new Error('unauthenticated');

  const { email, ngfRole } = context.auth.token;

  if (!email || !email.endsWith('@nynashamnsgf.se')) {
    throw new Error('forbidden: wrong domain');
  }
  if (!ngfRole) {
    throw new Error('forbidden: no role assigned — log out and back in');
  }
  if (requiredRole === 'siteAdmin' && ngfRole !== 'siteAdmin') {
    throw new Error('forbidden: siteAdmin required');
  }
  if (requiredRole === 'shopAdmin' && ngfRole !== 'siteAdmin' && ngfRole !== 'shopAdmin') {
    throw new Error('forbidden: shopAdmin required');
  }

  return ngfRole;
}

module.exports = { verifyAdmin, getRole };
