import { useEffect, useState }        from 'react';
import { httpsCallable }              from 'firebase/functions';
import { doc, getDoc }                from 'firebase/firestore';
import { useNavigate }                from 'react-router-dom';
import { IconCheck }                  from '@tabler/icons-react';
import { funcs, db }                  from '../../firebase';
import { useBasketCtx }               from '../../context/BasketContext';
import { useLangCtx }                 from '../../context/LangContext';

const getProductsFn  = httpsCallable(funcs, 'getProducts');
const checkCouponFn  = httpsCallable(funcs, 'checkCoupon');
const createOrderFn  = httpsCallable(funcs, 'createOrder');

// ── Stripe tile tones (matches Catalog / Product) ─────────────

const TILE_BG = ['#1B36C9', '#0A0A0A', '#F4F6FC', '#DCE3FF'];
const TILE_ST = [
  'rgba(255,255,255,.065)', 'rgba(255,255,255,.045)',
  'rgba(10,10,10,.04)',     'rgba(10,10,10,.035)',
];

function MiniTile({ index }) {
  const i  = index % 4;
  return (
    <div style={{
      width:      68,
      height:     80,
      borderRadius: 10,
      overflow:   'hidden',
      flexShrink: 0,
      background: `repeating-linear-gradient(135deg, ${TILE_BG[i]} 0 10px, ${TILE_ST[i]} 10px 20px), ${TILE_BG[i]}`,
    }} />
  );
}

// ── Qty controls ──────────────────────────────────────────────

function QtyCtrl({ qty, onInc, onDec }) {
  return (
    <div style={s.qtyCtrl}>
      <button onClick={onDec} style={s.qtyBtn} aria-label="Minska antal">−</button>
      <span style={s.qtyNum}>{qty}</span>
      <button onClick={onInc} style={{ ...s.qtyBtn, ...s.qtyBtnPlus }} aria-label="Öka antal">+</button>
    </div>
  );
}

// ── Applied coupon strip ──────────────────────────────────────

function CouponStrip({ coupon, onRemove }) {
  const discountKr = Math.round(coupon.discount / 100);
  return (
    <div style={s.couponStrip}>
      <div style={s.couponStripLeft}>
        <span style={s.couponIcon}><IconCheck size={12} /></span>
        <div>
          <span style={s.couponCode}>{coupon.code}</span>
          <span style={s.couponSaving}> · −{discountKr} kr</span>
        </div>
      </div>
      <button onClick={onRemove} style={s.couponRemove} aria-label="Ta bort rabattkod">
        Ta bort
      </button>
    </div>
  );
}

// ── Delivery selector ─────────────────────────────────────────
// Shows pick-up only when shippingEnabled is false (default).
// Shows both options as tap-target cards when shippingEnabled is true.

function DeliverySelector({ method, onSelect, shippingEnabled, deliveryCost }) {
  if (!shippingEnabled) {
    return (
      <div style={s.shippingNote}>
        <span style={s.shippingIcon}>📍</span>
        <span style={s.shippingText}>Upphämtning vid träning · Gratis</span>
      </div>
    );
  }

  const options = [
    {
      value: 'pickup',
      label: 'Upphämtning vid träning',
      meta:  'Bekräftas via e-post',
      price: 'Gratis',
      green: true,
    },
    {
      value: 'delivery',
      label: 'Hemleverans',
      meta:  'PostNord eller liknande',
      price: `${Math.round(deliveryCost / 100)} kr`,
      green: false,
    },
  ];

  return (
    <div style={s.deliverySection}>
      <p style={s.deliverySectionLabel}>Leveranssätt</p>
      {options.map(opt => {
        const active = method === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            aria-pressed={active}
            style={{
              ...s.deliveryOption,
              ...(active ? s.deliveryOptionActive : {}),
            }}>
            <div style={{ ...s.deliveryRadio, ...(active ? s.deliveryRadioActive : {}) }}>
              {active && <div style={s.deliveryRadioDot} />}
            </div>
            <div style={s.deliveryOptionInfo}>
              <span style={s.deliveryOptionLabel}>{opt.label}</span>
              <span style={s.deliveryOptionMeta}>{opt.meta}</span>
            </div>
            <span style={{
              ...s.deliveryOptionPrice,
              ...(opt.green ? { color: '#065F46' } : {}),
            }}>
              {opt.price}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Basket ────────────────────────────────────────────────────

export default function Basket() {
  const navigate           = useNavigate();
  const { basket, addItem, removeItem, clearBasket } = useBasketCtx();
  const { t }              = useLangCtx();

  const [products,        setProducts]        = useState({});
  const [siteConfig,      setSiteConfig]      = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [deliveryMethod,  setDeliveryMethod]  = useState('pickup');
  const [couponInput,     setCouponInput]     = useState('');
  const [couponError,     setCouponError]     = useState('');
  const [checkingCoupon,  setCheckingCoupon]  = useState(false);
  const [appliedCoupon,   setAppliedCoupon]   = useState(null);
  const [checkingOut,     setCheckingOut]     = useState(false);
  const [checkoutError,   setCheckoutError]   = useState('');

  // Fetch product details and site config in parallel
  useEffect(() => {
    Promise.all([
      getProductsFn().then(res => {
        const map = {};
        res.data.forEach(p => { map[p.id] = p; });
        return map;
      }),
      getDoc(doc(db, 'config', 'site')).then(snap =>
        snap.exists() ? snap.data() : null
      ),
    ])
      .then(([map, config]) => {
        setProducts(map);
        setSiteConfig(config);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build display items — skip any whose product is no longer visible
  const items = Object.entries(basket.items)
    .map(([id, { quantity, selectedVariations }], index) => ({
      productId:          id,
      product:            products[id],
      quantity,
      selectedVariations,
      toneIndex:          index,
    }))
    .filter(i => i.product);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal  = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const discount  = appliedCoupon?.discount || 0;

  // Delivery cost — calculated client-side for display only.
  // Server always recalculates from Firestore in createOrder.
  const totalUnits   = items.reduce((s, i) => s + ((i.product.shippingSize || 1) * i.quantity), 0);
  const sortedRules  = (siteConfig?.shippingRules || []).slice().sort((a, b) => a.maxUnits - b.maxUnits);
  const matchedRule  = sortedRules.find(r => totalUnits <= r.maxUnits) ?? sortedRules[sortedRules.length - 1];
  const deliveryCost = matchedRule?.costInOre ?? 0;

  const shippingCost = deliveryMethod === 'delivery' ? deliveryCost : 0;
  const total        = subtotal - discount + shippingCost;

  // ── Coupon ────────────────────────────────────────────────

  async function handleApplyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    setCheckingCoupon(true);
    try {
      const res = await checkCouponFn({ code, subtotalInOre: subtotal });
      if (res.data.valid) {
        setAppliedCoupon({ code, ...res.data });
        setCouponInput('');
      } else {
        const msgs = {
          expired:       'Rabattkoden har gått ut.',
          exhausted:     'Rabattkoden är förbrukad.',
          not_yet_valid: 'Rabattkoden är inte giltig ännu.',
          invalid:       'Ogiltig rabattkod.',
        };
        setCouponError(msgs[res.data.reason] || 'Ogiltig rabattkod.');
      }
    } catch {
      setCouponError('Kunde inte kontrollera koden. Försök igen.');
    } finally {
      setCheckingCoupon(false);
    }
  }

  function handleCouponKeyDown(e) {
    if (e.key === 'Enter') handleApplyCoupon();
  }

  // ── Checkout ──────────────────────────────────────────────

  async function handleCheckout() {
    setCheckoutError('');
    setCheckingOut(true);
    try {
      const res = await createOrderFn({
        items: Object.entries(basket.items).map(([productId, { quantity, selectedVariations }]) => ({
          productId,
          quantity,
          selectedVariations: selectedVariations || null,
        })),
        couponCode:     appliedCoupon?.code || null,
        deliveryMethod: deliveryMethod,
      });
      navigate('/checkout', { state: { html_snippet: res.data.html_snippet } });
    } catch (err) {
      setCheckoutError('Något gick fel. Kontrollera varukorgen och försök igen.');
      console.error('Checkout failed', err);
    } finally {
      setCheckingOut(false);
    }
  }

  // ── Empty state ───────────────────────────────────────────

  if (!loading && itemCount === 0) {
    return (
      <main style={s.emptyPage}>
        <p style={s.emptyText}>{t.basket.empty}</p>
        <button onClick={() => navigate('/')} style={s.emptyBtn}>
          Till butiken →
        </button>
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <main>

      {/* Hero */}
      <div style={s.hero}>
        <p style={s.heroSub}>
          <span style={s.heroMono}>{itemCount}</span>
          {itemCount === 1 ? ' vara' : ' varor'}
        </p>
        <h1 style={s.heroH1}>
          Nästan<br />
          <em style={s.heroEm}>redo.</em>
        </h1>
      </div>

      {/* Item list */}
      <div style={s.itemList}>
        {loading
          ? [0, 1].map(i => <div key={i} style={s.itemSkeleton} />)
          : items.map((item, idx) => {
              const { product, quantity, selectedVariations, toneIndex } = item;
              const lineTotal = Math.round(product.price * quantity / 100);
              const imgSrc    = product.imagesByColour?.[selectedVariations?.colour]
                             || product.images?.[0]
                             || null;
              const varLabel  = selectedVariations
                ? Object.values(selectedVariations).filter(Boolean).join(' · ')
                : null;

              return (
                <div key={item.productId} style={s.itemCard}>
                  {/* Thumbnail */}
                  {imgSrc ? (
                    <img src={imgSrc} alt={product.name} style={s.itemImg} />
                  ) : (
                    <MiniTile index={toneIndex} />
                  )}

                  {/* Info */}
                  <div style={s.itemInfo}>
                    <p style={s.itemName}>{product.name}</p>
                    {varLabel && (
                      <p style={s.itemVars}>{varLabel}</p>
                    )}
                    <div style={s.itemBottom}>
                      <QtyCtrl
                        qty={quantity}
                        onInc={() => addItem(item.productId, selectedVariations)}
                        onDec={() => removeItem(item.productId)}
                      />
                      <span style={s.itemTotal}>{lineTotal} kr</span>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Delivery selector */}
      <DeliverySelector
        method={deliveryMethod}
        onSelect={setDeliveryMethod}
        shippingEnabled={siteConfig?.shippingEnabled || false}
        deliveryCost={deliveryCost}
      />

      {/* Coupon */}
      <div style={s.couponSection}>
        {appliedCoupon ? (
          <CouponStrip
            coupon={appliedCoupon}
            onRemove={() => { setAppliedCoupon(null); setCouponError(''); }}
          />
        ) : (
          <>
            <div style={s.couponRow}>
              <input
                value={couponInput}
                onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                onKeyDown={handleCouponKeyDown}
                placeholder={t.basket.coupon}
                style={s.couponInput}
                aria-label={t.basket.coupon}
              />
              <button
                onClick={handleApplyCoupon}
                style={s.couponApply}
                disabled={!couponInput.trim() || checkingCoupon}>
                {checkingCoupon ? '…' : t.basket.apply}
              </button>
            </div>
            {couponError && (
              <p style={s.couponError} role="alert">{couponError}</p>
            )}
          </>
        )}
      </div>

      {/* Order summary */}
      <div style={s.summary}>
        <div style={s.summaryRow}>
          <span style={s.summaryLabel}>{t.basket.subtotal}</span>
          <span style={s.summaryVal}>{Math.round(subtotal / 100)} kr</span>
        </div>
        <div style={s.summaryRow}>
          <span style={s.summaryLabel}>{t.basket.shipping}</span>
          {deliveryMethod === 'delivery'
            ? <span style={s.summaryVal}>{Math.round(deliveryCost / 100)} kr</span>
            : <span style={{ ...s.summaryVal, color: '#065F46' }}>Gratis</span>
          }
        </div>
        {discount > 0 && (
          <div style={s.summaryRow}>
            <span style={s.summaryLabel}>{t.basket.discount}</span>
            <span style={{ ...s.summaryVal, color: '#065F46' }}>
              −{Math.round(discount / 100)} kr
            </span>
          </div>
        )}
        <div style={s.divider} />
        <div style={s.totalRow}>
          <span style={s.totalLabel}>{t.basket.total}</span>
          <span style={s.totalVal}>{Math.round(total / 100)} kr</span>
        </div>
      </div>

      {/* CTA */}
      <div style={s.ctaArea}>
        {checkoutError && (
          <p style={s.checkoutError} role="alert">{checkoutError}</p>
        )}
        <button
          onClick={handleCheckout}
          style={{ ...s.cta, ...(checkingOut ? s.ctaLoading : {}) }}
          disabled={checkingOut || itemCount === 0}>
          {checkingOut ? 'Förbereder kassan…' : t.basket.checkout + ' →'}
        </button>
        <p style={s.savedNote}>
          <span style={s.savedIcon}>🕐</span> {t.basket.savedFor}
        </p>
      </div>

    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = {
  // Empty state
  emptyPage: {
    minHeight:      '60vh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '40px 20px',
    gap:            20,
  },
  emptyText: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   16,
    color:      'rgba(10,10,10,.45)',
  },
  emptyBtn: {
    padding:      '12px 24px',
    borderRadius: 999,
    border:       'none',
    background:   '#1B36C9',
    color:        '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     14,
    fontWeight:   600,
    cursor:       'pointer',
  },

  // Hero
  hero: {
    padding: '22px 20px 6px',
  },
  heroSub: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      13,
    color:         'rgba(10,10,10,.5)',
    marginBottom:  6,
  },
  heroMono: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 500,
  },
  heroH1: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      'clamp(30px, 8vw, 38px)',
    lineHeight:    0.93,
    letterSpacing: '-0.05em',
    color:         '#0A0A0A',
  },
  heroEm: {
    fontStyle:  'italic',
    fontWeight: 500,
  },

  // Items
  itemList: {
    padding:       '16px 16px 0',
    display:       'flex',
    flexDirection: 'column',
    gap:           10,
  },
  itemSkeleton: {
    height:       96,
    borderRadius: 14,
    background:   'rgba(10,10,10,.05)',
    animation:    'pulse 1.5s ease-in-out infinite',
  },
  itemCard: {
    background:   '#fff',
    borderRadius: 14,
    border:       '0.5px solid rgba(10,10,10,.055)',
    padding:      12,
    display:      'flex',
    gap:          12,
    alignItems:   'stretch',
  },
  itemImg: {
    width:        68,
    height:       80,
    borderRadius: 10,
    objectFit:    'cover',
    flexShrink:   0,
  },
  itemInfo: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minWidth:      0,
  },
  itemName: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      14,
    fontWeight:    600,
    letterSpacing: '-0.2px',
    color:         '#0A0A0A',
    marginBottom:  2,
  },
  itemVars: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    letterSpacing: '.3px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.45)',
    marginBottom:  0,
  },
  itemBottom: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      8,
  },
  itemTotal: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   13.5,
    fontWeight: 500,
    color:      '#0A0A0A',
  },

  // Qty controls
  qtyCtrl: {
    display:      'flex',
    alignItems:   'center',
    gap:          3,
    borderRadius: 999,
    border:       '0.5px solid rgba(10,10,10,.1)',
    padding:      3,
    background:   '#fff',
  },
  qtyBtn: {
    width:           24,
    height:          24,
    borderRadius:    999,
    border:          'none',
    background:      'rgba(10,10,10,.06)',
    color:           '#0A0A0A',
    fontSize:        14,
    fontWeight:      500,
    cursor:          'pointer',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    lineHeight:      1,
    fontFamily:      "'Space Grotesk', system-ui, sans-serif",
  },
  qtyBtnPlus: {
    background: '#0A0A0A',
    color:      '#fff',
  },
  qtyNum: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      12,
    fontWeight:    500,
    minWidth:      18,
    textAlign:     'center',
    color:         '#0A0A0A',
  },

  // Shipping note (pick-up only — shippingEnabled = false)
  shippingNote: {
    margin:       '14px 16px 0',
    padding:      '10px 14px',
    borderRadius: 10,
    background:   '#F4F6FC',
    display:      'flex',
    alignItems:   'center',
    gap:          8,
  },
  shippingIcon: { fontSize: 14 },
  shippingText: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   12.5,
    fontWeight: 500,
    color:      '#2A2A2E',
  },

  // Delivery selector (shippingEnabled = true)
  deliverySection: { margin: '14px 16px 0' },
  deliverySectionLabel: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.45)',
    marginBottom:  8,
  },
  deliveryOption: {
    width:      '100%',
    display:    'flex',
    alignItems: 'center',
    gap:        12,
    padding:    '12px 14px',
    borderRadius: 13,
    border:     '0.5px solid rgba(10,10,10,.1)',
    background: '#fff',
    cursor:     'pointer',
    marginBottom: 6,
    textAlign:  'left',
  },
  deliveryOptionActive: { border: '1.5px solid #0A0A0A' },
  deliveryRadio: {
    width:          18,
    height:         18,
    borderRadius:   '50%',
    border:         '1.5px solid rgba(10,10,10,.2)',
    flexShrink:     0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  },
  deliveryRadioActive: { border: '1.5px solid #0A0A0A' },
  deliveryRadioDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#0A0A0A',
  },
  deliveryOptionInfo: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
  },
  deliveryOptionLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13.5,
    fontWeight: 600,
    color:      '#0A0A0A',
  },
  deliveryOptionMeta: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    letterSpacing: '.3px',
    color:         'rgba(10,10,10,.45)',
  },
  deliveryOptionPrice: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   13,
    fontWeight: 500,
    color:      '#0A0A0A',
    flexShrink: 0,
  },

  // Coupon
  couponSection: {
    padding: '14px 16px 0',
  },
  couponRow: {
    display:     'flex',
    gap:         8,
    border:      '1px dashed rgba(10,10,10,.15)',
    borderRadius: 13,
    padding:     '10px 12px',
    alignItems:  'center',
    background:  '#fff',
  },
  couponInput: {
    flex:       1,
    border:     'none',
    outline:    'none',
    background: 'transparent',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13,
    color:      '#0A0A0A',
    letterSpacing: '0.3px',
  },
  couponApply: {
    flexShrink:   0,
    padding:      '6px 14px',
    borderRadius: 999,
    border:       'none',
    background:   '#0A0A0A',
    color:        '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
  },
  couponError: {
    fontSize:     12,
    color:        '#DC2626',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    marginTop:    6,
    fontWeight:   500,
  },
  couponStrip: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    background:     '#EAF5EF',
    borderRadius:   13,
    padding:        '11px 14px',
    border:         '0.5px solid rgba(6,95,70,.2)',
  },
  couponStripLeft: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
  },
  couponIcon: {
    width:           22,
    height:          22,
    borderRadius:    6,
    background:      '#1B36C9',
    color:           '#fff',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  couponCode: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   12,
    fontWeight: 500,
    color:      '#065F46',
    letterSpacing: '.3px',
  },
  couponSaving: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   12.5,
    fontWeight: 600,
    color:      '#065F46',
  },
  couponRemove: {
    background: 'none',
    border:     'none',
    fontSize:   12,
    color:      'rgba(10,10,10,.45)',
    cursor:     'pointer',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },

  // Summary
  summary: {
    padding: '16px 20px 0',
  },
  summaryRow: {
    display:        'flex',
    justifyContent: 'space-between',
    padding:        '5px 0',
  },
  summaryLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13.5,
    color:      'rgba(10,10,10,.55)',
  },
  summaryVal: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   13.5,
    color:      '#0A0A0A',
  },
  divider: {
    height:     '0.5px',
    background: 'rgba(10,10,10,.09)',
    margin:     '10px 0',
  },
  totalRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'baseline',
  },
  totalLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   15,
    fontWeight: 700,
    color:      '#0A0A0A',
  },
  totalVal: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      24,
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
  },

  // CTA area
  ctaArea: {
    padding: '16px 16px 36px',
  },
  cta: {
    width:         '100%',
    height:        52,
    borderRadius:  999,
    border:        'none',
    background:    '#1B36C9',
    color:         '#fff',
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      14.5,
    fontWeight:    700,
    cursor:        'pointer',
    letterSpacing: '-0.02em',
    transition:    'background 0.15s',
  },
  ctaLoading: {
    background: '#6B88FF',
    cursor:     'wait',
  },
  checkoutError: {
    fontSize:     12.5,
    color:        '#DC2626',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    marginBottom: 10,
    fontWeight:   500,
    textAlign:    'center',
  },
  savedNote: {
    marginTop:  10,
    textAlign:  'center',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   10,
    letterSpacing: '.4px',
    textTransform: 'uppercase',
    color:      'rgba(10,10,10,.38)',
  },
  savedIcon: { fontSize: 11 },
};
