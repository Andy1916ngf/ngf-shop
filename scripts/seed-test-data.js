/**
 * Seed script — populates Firestore with test products, coupons, and page content.
 *
 * Run via GitHub Actions:
 *   GitHub → Actions → "Seed test data" → Run workflow → type SEED → Run
 *
 * The workflow uses the FIREBASE_SERVICE_ACCOUNT GitHub Secret for auth.
 * No local tools or key files are needed.
 *
 * Safe to run multiple times — all writes use set() with a fixed document ID (idempotent).
 * WARNING: running against the production project will overwrite live data.
 */

const admin = require('firebase-admin');

// When run via GitHub Actions, GOOGLE_APPLICATION_CREDENTIALS points to a
// temporary key file written by the workflow. No manual key management needed.
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId:  process.env.GCP_PROJECT_ID,
});
const db = admin.firestore();

// ── Test products — one for each variation combination ─────────

const PRODUCTS = [
  {
    id: 'hoodie-ngf-test',
    name: 'NGF Hoodie',
    description: 'Officiell NGF-hoodie i mjuk bomullsblandning. Broderat klubbmärke på bröstet.',
    price: 44900,             // 449 kr in öre
    currency: 'SEK',
    category: 'Kläder',
    stock: 20,
    visible: true,
    images: [],
    onSale:        false,
    originalPrice: null,        // öre — shown struck-through when onSale is true
    imagesByColour: null,   // { "Marinblå": "url", "Svart": "url" } — set via admin panel
    sizeGuideUrl: null,     // URL to size guide PDF or page — set via admin panel
    shippingSize: 3,        // ~same volume as 3 t-shirts; used to calculate delivery cost
    variations: {
      colours:    ['Marinblå', 'Svart', 'Vit'],
      sizes:      ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      customText: true,
    },
  },
  {
    id: 'linne-ngf-test',
    name: 'NGF Linne',
    description: 'Lätt träningslinne i tekniskt material.',
    price: 29900,
    currency: 'SEK',
    category: 'Kläder',
    stock: 15,
    visible: true,
    images: [],
    onSale:        false,
    originalPrice: null,
    imagesByColour: null,
    sizeGuideUrl: null,
    shippingSize: 1,        // flat — same as a t-shirt
    variations: {
      colours:    null,
      sizes:      ['XS', 'S', 'M', 'L', 'XL'],
      customText: true,
    },
  },
  {
    id: 'strumpor-test',
    name: 'Trampolinstrumpor',
    description: 'Halkskyddsstrumpor för trampolinträning.',
    price: 9900,
    currency: 'SEK',
    category: 'Utrustning',
    stock: 50,
    visible: true,
    images: [],
    onSale:        false,
    originalPrice: null,
    imagesByColour: null,
    sizeGuideUrl: null,     // set to a size guide URL if available
    shippingSize: 1,        // small and flat
    variations: {
      colours:    null,
      sizes:      ['S (28–32)', 'M (33–37)', 'L (38–42)', 'XL (43–46)'],
      customText: false,
    },
  },
  {
    id: 'vattenflaska-test',
    name: 'NGF Vattenflaska',
    description: '500 ml BPA-fri vattenflaska med NGF-logotyp.',
    price: 19900,
    currency: 'SEK',
    category: 'Tillbehör',
    stock: 30,
    visible: true,
    images: [],
    onSale:        false,
    originalPrice: null,
    imagesByColour: null,
    sizeGuideUrl: null,
    shippingSize: 3,        // cylindrical — roughly same volume as a hoodie
    variations: {
      colours:    null,
      sizes:      null,
      customText: false,
    },
  },
  {
    id: 'hidden-product-test',
    name: 'Dold testprodukt',
    description: 'Ska aldrig synas i butiken.',
    price: 9900,
    currency: 'SEK',
    category: 'Test',
    stock: 1,
    visible: false,
    images: [],
    onSale:        false,
    originalPrice: null,
    imagesByColour: null,
    sizeGuideUrl: null,
    shippingSize: 1,
    variations: { colours: null, sizes: null, customText: false },
  },
];

// ── Test coupons — covers all edge cases ───────────────────────

const COUPONS = [
  {
    id: 'TEST10',             // valid, 10% off, unlimited use
    type: 'percent',
    value: 10,
    validFrom:  null,
    validUntil: null,
    usageLimit: null,
    timesUsed:  0,
    active:     true,
  },
  {
    id: 'FAST50',             // valid, fixed 50 kr off, max 5 uses
    type: 'fixed',
    value: 5000,              // 50 kr in öre
    validFrom:  null,
    validUntil: null,
    usageLimit: 5,
    timesUsed:  0,
    active:     true,
  },
  {
    id: 'EXPIRED',            // expired — should be silently rejected
    type: 'percent',
    value: 20,
    validFrom:  null,
    validUntil: admin.firestore.Timestamp.fromDate(new Date('2020-01-01')),
    usageLimit: null,
    timesUsed:  0,
    active:     true,
  },
  {
    id: 'MAXEDOUT',           // exhausted — should be silently rejected
    type: 'fixed',
    value: 10000,
    validFrom:  null,
    validUntil: null,
    usageLimit: 1,
    timesUsed:  1,            // already fully used
    active:     true,
  },
];

// ── Static page content ────────────────────────────────────────

const CONTENT = [
  {
    id: 'about',
    title: 'Om NGF',
    body: '<h2>Om Nynäshamns Gymnastikförening</h2><p>Välkommen till NGF:s officiella butik. Här hittar du klubbkläder och träningsutrustning.</p>',
  },
  {
    id: 'tac',
    title: 'Köpvillkor',
    body: '<h2>Köpvillkor</h2><p>Alla priser anges inklusive moms. Betalning via Kustom Checkout. Ångerrätt 14 dagar enligt distansavtalslagen.</p>',
  },
  {
    id: 'faq',
    title: 'Vanliga frågor',
    body: '<h2>Vanliga frågor</h2><p><strong>Hur hämtar jag min order?</strong></p><p>Du meddelas via e-post när ordern är klar. Upphämtning sker vid ordinarie träning.</p><p><strong>Kan jag ångra mitt köp?</strong></p><p>Ja, kontakta oss inom 14 dagar.</p>',
  },
];

// ── Initial site config ────────────────────────────────────────

const SITE_CONFIG = {
  shopName:        'NGF Butik',
  currency:        'SEK',
  maintenanceMode: false,
  categories: ['Kläder', 'Utrustning', 'Tillbehör'],
  colours: [
    { name: 'Marinblå', hex: '#1B36C9' },
    { name: 'Svart',    hex: '#0A0A0A' },
    { name: 'Vit',      hex: '#FFFFFF' },
    { name: 'Röd',      hex: '#DC2626' },
    { name: 'Grön',     hex: '#16A34A' },
    { name: 'Grå',      hex: '#9CA3AF' },
    { name: 'Gul',      hex: '#FBBF24' },
    { name: 'Orange',   hex: '#EA580C' },
    { name: 'Rosa',     hex: '#EC4899' },
  ],
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'S (28–32)', 'M (33–37)', 'L (38–42)', 'XL (43–46)'],
  shippingEnabled: false,   // toggle in admin Settings to offer home delivery
  shippingRules: [          // costInOre per bracket; sorted ascending by maxUnits at runtime
    { maxUnits: 3,  costInOre: 4900 },   // 49 kr — e.g. 1 hoodie or 3 t-shirts
    { maxUnits: 8,  costInOre: 7900 },   // 79 kr — medium mixed order
    { maxUnits: 20, costInOre: 9900 },   // 99 kr — large order; last rule is the ceiling
  ],
  hero: {
    type:       'banner',
    imageUrl:   null,
    headline:   'Tränat för',
    heroItalic: 'rörelsen.',
    subheadline: 'Säsong 26 · Vårkollektion',
    linkUrl:    null,
  },
};

// ── Seed ───────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  Seeding Firestore with test data\n');

  console.log('Products:');
  for (const { id, ...data } of PRODUCTS) {
    await db.doc(`products/${id}`).set({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✓ ${data.name} (${data.visible ? 'visible' : 'hidden'})`);
  }

  console.log('\nCoupons:');
  for (const { id, ...data } of COUPONS) {
    await db.doc(`coupons/${id}`).set(data);
    console.log(`  ✓ ${id}`);
  }

  console.log('\nContent pages:');
  for (const { id, ...data } of CONTENT) {
    await db.doc(`content/${id}`).set({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✓ ${id}`);
  }

  console.log('Admin roles:');
  await db.doc('config/adminRoles').set({
    siteAdmins: [
      'anders@nynashamnsgf.se',
    ],
    shopAdmins: [],
  });
  console.log('  ✔ config/adminRoles');

  console.log('\nSite config:');
  await db.doc('config/site').set(SITE_CONFIG);
  console.log('  ✓ config/site');

  console.log('\n✅  Done. Remember to create adminRoles/roles manually.\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});