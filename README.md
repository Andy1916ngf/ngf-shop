# NGF Webshop — Oasis

> Officiell klubbutik för Nynäshamns Gymnastikförening.
> Stack: Vite + React · Firebase Hosting · Firestore · Cloud Functions · Kustom Checkout

---

## Quick reference

| What | File(s) |
|---|---|
| Firebase config | `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules` |
| CI/CD | `.github/workflows/deploy.yml` |
| Backend functions | `functions/src/` |
| Frontend app | `frontend/src/` |
| Translation strings | `frontend/src/i18n/sv.json`, `en.json` |
| Basket logic | `frontend/src/hooks/useBasket.js` |
| Auth / role check | `frontend/src/hooks/useAuth.js`, `functions/src/auth.js` |
| Kustom integration | `functions/src/checkout.js`, `functions/src/webhook.js` |
| Order management | `functions/src/orders.js` |
| Product CRUD | `functions/src/products.js` |
| Static page content | `functions/src/content.js`, `frontend/src/pages/StaticPage.jsx` |
| Email | `functions/src/mail.js` |
| Test seed data | `scripts/seed-test-data.js` |

---

## Setup checklist

### 1. Firebase project

- [ ] Create project at [console.firebase.google.com](https://console.firebase.google.com) — name: `ngf-shop`
- [ ] Upgrade to **Blaze** plan (required for Cloud Functions outbound HTTPS calls to Kustom)
- [ ] Enable: Authentication (Google), Firestore (`europe-north1`), Storage (`europe-north1`), Functions
- [ ] Set Google Auth authorised domain: `butik.nynashamnsgf.se`

### 2. Cost guardrails (do before first deploy)

- [ ] Google Cloud Console → Billing → Budgets & alerts → create €1 budget with email alert
- [ ] Verify `maxInstances: 10` is set in `functions/src/index.js` (already present)

### 3. Environment variables

```bash
# Frontend: copy and fill in
cp frontend/.env.example frontend/.env.local

# Functions: copy and fill in
cp functions/.env.example functions/.env

# Deploy function env vars to Firebase
firebase functions:config:set \
  kustom.api_url="https://api.playground.kustom.co" \
  kustom.api_key="REPLACE_ME" \
  kustom.webhook_secret="REPLACE_ME" \
  app.shop_domain="https://butik.nynashamnsgf.se" \
  app.admin_email="butik@nynashamnsgf.se"
```

### 4. GitHub repository secrets

Add under: Repository → Settings → Secrets and variables → Actions

| Secret | Source |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same |
| `VITE_FIREBASE_PROJECT_ID` | Same |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same |
| `VITE_FIREBASE_APP_ID` | Same |
| `FIREBASE_TOKEN` | Run `firebase login:ci` locally and copy the token |

### 5. Initial Firestore documents (create once via Firebase Console)

**`adminRoles/roles`**
```json
{
  "siteAdmins": ["YOUR_EMAIL@nynashamnsgf.se"],
  "shopAdmins": []
}
```

### 6. Seed test data

```bash
# Download service account key from Firebase Console →
# Project Settings → Service accounts → Generate new private key
# Save as scripts/serviceAccountKey.json (already in .gitignore)

cd scripts
node seed-test-data.js
```

### 7. Firebase Trigger Email extension

1. Firebase Console → Extensions → Install **Trigger Email from Firestore**
2. SMTP URI: `smtps://noreply@nynashamnsgf.se:APP_PASSWORD@smtp.gmail.com:465`
   - Replace `APP_PASSWORD` with a Gmail App Password:
     Google Account → Security → 2-Step Verification → App passwords
3. Mail collection: `mail`
4. Default from: `"NGF Butik" <noreply@nynashamnsgf.se>`

---

## DNS configuration (Loopia)

The shop runs on `butik.nynashamnsgf.se`.
The existing website at `nynashamnsgf.se` is completely unaffected.

**Steps in Loopia Kundzon:**

1. Log in → Domäner → `nynashamnsgf.se` → **DNS-hantering**
2. Firebase first asks for a **TXT record** to verify domain ownership:
   - Subdomain/host: `butik`
   - Type: `TXT`
   - Value: *(provided by Firebase during "Add custom domain" wizard)*
   - TTL: 3600 (or Loopia default)
3. After verification, Firebase asks for a **CNAME record**:
   - Subdomain/host: `butik`
   - Type: `CNAME`
   - Value: `ngf-shop.web.app` *(use the exact value Firebase gives you)*
   - TTL: 3600
4. Save. Propagation is typically 15–60 minutes with Loopia; up to 24 hours worst case.
5. HTTPS is provisioned automatically by Firebase once DNS resolves.

**Potential issue — wildcard record:**
If Loopia has a wildcard DNS record (`*`) pointing at Loopia's own servers,
the `butik` CNAME will override it correctly for that subdomain.
If Firebase verification stalls, temporarily remove the wildcard record,
complete verification, then restore it. Only `butik` is affected.

**Where to do this in Firebase:**
Firebase Console → Hosting → Add custom domain → enter `butik.nynashamnsgf.se`
→ follow the on-screen steps.

---

## Email — butik@nynashamnsgf.se

Both outgoing emails (to customers) and incoming order notifications (to admins)
use `butik@nynashamnsgf.se`.

**Setup in Google Workspace Admin:**
1. Google Workspace Admin Console → Groups → Create group
2. Name: `NGF Butik`, Email: `butik@nynashamnsgf.se`
3. Add all Shop Admins as members
4. Set group permissions so external senders can email the group (for customer replies)

The Firebase Trigger Email extension sends from `"NGF Butik" <butik@nynashamnsgf.se>`.
New order notifications go *to* `butik@nynashamnsgf.se`, which delivers to all group members.

---

## Google Workspace Groups — admin roles

Roles are controlled by Google Workspace group membership, not by Firestore documents.
When an admin logs in, the `getRole` Cloud Function queries the Directory API,
derives the role, and sets a Firebase custom claim. Firestore rules check the claim.

**One-time setup:**

### Step 1 — Create the groups
Google Workspace Admin Console → Groups → Create group:

| Group name | Email |
|---|---|
| NGF Shop Site Admins | `shop-site-admins@nynashamnsgf.se` |
| NGF Shop Admins | `butik@nynashamnsgf.se` |

Add members to each group. Site Admins also need to be in the Shop Admins group,
OR the code checks Site Admin first and falls through — either works.

### Step 2 — Enable domain-wide delegation
1. Google Cloud Console → IAM → Service Accounts
2. Find the **Firebase Admin SDK Service Agent** (or the service account used by Functions)
3. Actions → Edit → Enable G Suite Domain-wide Delegation → Save
4. Copy the **Client ID**

### Step 3 — Grant the Directory API scope
1. Google Workspace Admin Console → Security → API controls → Domain-wide delegation
2. Add new → paste the **Client ID** from Step 2
3. OAuth scopes: `https://www.googleapis.com/auth/admin.directory.group.member.readonly`
4. Authorise

### Step 4 — Set environment variables
```
GOOGLE_ADMIN_EMAIL=YOUR_WORKSPACE_ADMIN@nynashamnsgf.se
GOOGLE_GROUPS_SITE_ADMIN=shop-site-admins@nynashamnsgf.se
GOOGLE_GROUPS_SHOP_ADMIN=butik@nynashamnsgf.se
```

After this, adding or revoking admin access is a standard Google Workspace Admin task —
no code or database changes needed.

---

## Kustom sandbox → production switch

When ready to go live:

1. Update `KUSTOM_API_URL` from `https://api.playground.kustom.co` to `https://api.kustom.co`
2. Replace sandbox API key with production key
3. Replace sandbox webhook secret with production secret
4. Update webhook endpoint URL in Kustom Portal to `https://europe-north1-PROJECT_ID.cloudfunctions.net/kustomWebhook`
5. Confirm `SHOP_DOMAIN=https://butik.nynashamnsgf.se` in production env
6. `firebase deploy`

---

## Local development

```bash
# Frontend
cd frontend
npm install
npm run dev         # http://localhost:5173

# Functions (Firebase emulator)
firebase emulators:start --only functions,firestore

# Run frontend tests
cd frontend && npm test

# Run function tests
cd functions && npm test
```

---

## File structure

```
Oasis/
├── .github/workflows/deploy.yml     CI/CD
├── frontend/                        Vite + React app
│   ├── src/
│   │   ├── App.jsx                  Router
│   │   ├── firebase.js              SDK init
│   │   ├── hooks/                   useBasket, useAuth, useLang
│   │   ├── i18n/                    sv.json, en.json
│   │   ├── components/              Header, Footer, RichText
│   │   └── pages/
│   │       ├── shop/                Catalog, Product, Basket, Checkout
│   │       ├── admin/               AdminLayout, Login, Orders, OrderDetail,
│   │       │                        Products, ProductEdit, Settings
│   │       ├── StaticPage.jsx       About / T&C / FAQ
│   │       └── Confirmation.jsx
├── functions/src/                   Cloud Functions
│   ├── index.js                     Exports + maxInstances cap
│   ├── auth.js                      Role verification
│   ├── checkout.js                  Kustom order create/read
│   ├── webhook.js                   Kustom webhook receiver
│   ├── orders.js                    Capture / ship / deliver / cancel
│   ├── products.js                  Product CRUD + image upload URL
│   ├── content.js                   Static pages + site config
│   └── mail.js                      Email queue helper
├── scripts/seed-test-data.js        Populate Firestore for testing
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
└── .firebaserc
```
