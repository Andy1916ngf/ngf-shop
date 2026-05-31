import { useEffect, useState }  from 'react';
import { useSearchParams,
         useNavigate }          from 'react-router-dom';
import { httpsCallable }        from 'firebase/functions';
import { funcs }                from '../firebase';
import { useBasketCtx }         from '../context/BasketContext';
import { useLangCtx }           from '../context/LangContext';

const readOrderFn = httpsCallable(funcs, 'readOrder');

// ── Animated check circle (CSS-only) ─────────────────────────

function CheckCircle() {
  return (
    <div style={s.checkWrap}>
      <svg
        viewBox="0 0 52 52"
        style={s.checkSvg}
        aria-hidden="true">
        <circle
          cx="26" cy="26" r="25"
          fill="none"
          stroke="#1B36C9"
          strokeWidth="2"
          style={s.checkCircle}
        />
        <path
          fill="none"
          stroke="#1B36C9"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 27 l9 9 l16-18"
          style={s.checkMark}
        />
      </svg>
    </div>
  );
}

// ── Next-steps list ───────────────────────────────────────────

function NextSteps({ deliveryMethod }) {
  const steps = deliveryMethod === 'delivery'
    ? [
        { icon: '✉️', text: 'En orderbekräftelse har skickats till din e-postadress.' },
        { icon: '✅', text: 'Vi meddelar dig när din order är bekräftad och klar.' },
        { icon: '📬', text: 'Du får ett nytt meddelande när ordern är skickad.' },
      ]
    : [
        { icon: '✉️', text: 'En orderbekräftelse har skickats till din e-postadress.' },
        { icon: '✅', text: 'Vi meddelar dig när din order är klar att hämta.' },
        { icon: '📍', text: 'Hämta din order vid ordinarie träning.' },
      ];

  return (
    <div style={s.nextSteps}>
      <p style={s.nextStepsTitle}>Vad händer nu?</p>
      {steps.map((step, i) => (
        <div key={i} style={s.step}>
          <span style={s.stepIcon}>{step.icon}</span>
          <span style={s.stepText}>{step.text}</span>
        </div>
      ))}
    </div>
  );
}

// ── Order line ────────────────────────────────────────────────

function OrderLine({ item }) {
  const varLabel = item.selectedVariations
    ? Object.values(item.selectedVariations).filter(Boolean).join(' · ')
    : null;

  return (
    <div style={s.orderLine}>
      <div style={s.orderLineInfo}>
        <span style={s.orderLineName}>{item.name}</span>
        {varLabel && <span style={s.orderLineVars}>{varLabel}</span>}
      </div>
      <div style={s.orderLineRight}>
        {item.quantity > 1 && (
          <span style={s.orderLineQty}>×{item.quantity}</span>
        )}
        <span style={s.orderLinePrice}>
          {Math.round(item.unitPrice * item.quantity / 100)} kr
        </span>
      </div>
    </div>
  );
}

// ── Confirmation ──────────────────────────────────────────────

export default function Confirmation() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { clearBasket } = useBasketCtx();
  const { t }           = useLangCtx();

  const orderId = searchParams.get('order_id');
  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    // Clear the basket — payment is complete
    clearBasket();

    if (!orderId) { setLoading(false); setError(true); return; }

    readOrderFn({ orderId })
      .then(res => setOrder(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [orderId]);

  // ── Loading ─────────────────────────────────────────────────

  if (loading) {
    return (
      <main style={s.statusPage}>
        <div style={s.spinner} aria-label="Laddar…" />
        <p style={s.statusText}>Hämtar din order…</p>
      </main>
    );
  }

  // ── Error / order not found ──────────────────────────────────
  // Payment was still taken — reassure rather than alarm.

  if (error || !order) {
    return (
      <main style={s.statusPage}>
        <CheckCircle />
        <h1 style={s.heroH1}>Tack för din beställning!</h1>
        <p style={s.heroSub}>
          Din betalning är registrerad. En orderbekräftelse har skickats
          till din e-postadress.
        </p>
        <p style={s.contactNote}>
          Frågor? Skriv till{' '}
          <a href="mailto:butik@nynashamnsgf.se" style={s.emailLink}>
            butik@nynashamnsgf.se
          </a>
        </p>
        <button onClick={() => navigate('/')} style={s.cta}>
          Fortsätt handla →
        </button>
      </main>
    );
  }

  // ── Success ──────────────────────────────────────────────────

  const subtotal = order.items.reduce(
    (s, i) => s + i.unitPrice * i.quantity, 0
  );

  return (
    <main style={s.page}>

      {/* Hero */}
      <div style={s.hero}>
        <CheckCircle />
        <h1 style={s.heroH1}>Tack för din beställning!</h1>
        <p style={s.heroSub}>
          En bekräftelse skickas till din e-postadress.
        </p>
        <div style={s.orderIdBadge}>
          <span style={s.orderIdLabel}>Order</span>
          <span style={s.orderIdVal}>
            {order.shortRef || order.orderId.slice(0, 8).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Next steps */}
      <NextSteps deliveryMethod={order.deliveryMethod} />

      {/* Order summary */}
      <div style={s.summaryCard}>
        <p style={s.summaryTitle}>Din beställning</p>

        <div style={s.orderLines}>
          {order.items.map((item, i) => (
            <OrderLine key={i} item={item} />
          ))}
        </div>

        <div style={s.divider} />

        {/* Totals */}
        <div style={s.totalRow}>
          <span style={s.totalLabel}>Delsumma</span>
          <span style={s.totalVal}>{Math.round(subtotal / 100)} kr</span>
        </div>

        {order.discountAmount > 0 && (
          <div style={s.totalRow}>
            <span style={s.totalLabel}>
              Rabatt{order.couponCode ? ` (${order.couponCode})` : ''}
            </span>
            <span style={{ ...s.totalVal, color: '#065F46' }}>
              −{Math.round(order.discountAmount / 100)} kr
            </span>
          </div>
        )}

        <div style={s.totalRow}>
          <span style={s.totalLabel}>
            {order.deliveryMethod === 'delivery' ? 'Hemleverans' : 'Upphämtning'}
          </span>
          <span style={{
            ...s.totalVal,
            color: order.shippingCost === 0 ? '#065F46' : '#0A0A0A',
          }}>
            {order.shippingCost === 0
              ? 'Gratis'
              : `${Math.round(order.shippingCost / 100)} kr`}
          </span>
        </div>

        <div style={s.grandDivider} />

        <div style={s.grandRow}>
          <span style={s.grandLabel}>Totalt</span>
          <span style={s.grandVal}>
            {Math.round(order.totalAmount / 100)} kr
          </span>
        </div>
      </div>

      {/* Contact */}
      <p style={s.contactNote}>
        Frågor om din order? Skriv till{' '}
        <a href="mailto:butik@nynashamnsgf.se" style={s.emailLink}>
          butik@nynashamnsgf.se
        </a>
      </p>

      {/* CTA */}
      <div style={s.ctaWrap}>
        <button onClick={() => navigate('/')} style={s.cta}>
          Fortsätt handla →
        </button>
      </div>

    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────

const CHECK_DASH = 36; // approximate path length for stroke-dashoffset animation

const s = {
  // Status / loading
  statusPage: {
    minHeight:      '70vh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '40px 24px',
    gap:            16,
    textAlign:      'center',
  },
  spinner: {
    width:  40,
    height: 40,
    borderRadius: '50%',
    border: '3px solid #DCE3FF',
    borderTopColor: '#1B36C9',
    animation: 'spin 0.8s linear infinite',
  },
  statusText: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   14,
    color:      'rgba(10,10,10,.45)',
  },

  // Check circle (CSS animation via style tag in index.css)
  checkWrap: {
    width:        72,
    height:       72,
    marginBottom: 4,
  },
  checkSvg: {
    width:    72,
    height:   72,
    animation: 'confirmPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
  },
  checkCircle: {
    strokeDasharray:  '157',
    strokeDashoffset: '157',
    animation: 'circleDraw 0.5s ease forwards',
  },
  checkMark: {
    strokeDasharray:  `${CHECK_DASH}`,
    strokeDashoffset: `${CHECK_DASH}`,
    animation: 'checkDraw 0.35s ease 0.4s forwards',
  },

  // Main page
  page: {
    minHeight:   '100vh',
    paddingBottom: 48,
  },

  // Hero
  hero: {
    padding:    '32px 24px 24px',
    textAlign:  'center',
    display:    'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap:        8,
  },
  heroH1: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      'clamp(22px, 6vw, 28px)',
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
    lineHeight:    1.1,
  },
  heroSub: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   14,
    color:      'rgba(10,10,10,.52)',
    maxWidth:   280,
    lineHeight: 1.5,
  },
  orderIdBadge: {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    background:   '#F4F6FC',
    borderRadius: 999,
    padding:      '6px 16px',
    marginTop:    4,
  },
  orderIdLabel: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.45)',
  },
  orderIdVal: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      13,
    fontWeight:    600,
    color:         '#0A0A0A',
    letterSpacing: '1px',
  },

  // Next steps
  nextSteps: {
    margin:  '0 16px 16px',
    padding: '16px',
    background:   '#F4F6FC',
    borderRadius: 16,
  },
  nextStepsTitle: {
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     11,
    fontWeight:   600,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color:        'rgba(10,10,10,.45)',
    marginBottom: 12,
  },
  step: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        12,
    marginBottom: 10,
  },
  stepIcon: { fontSize: 16, flexShrink: 0, lineHeight: 1.4 },
  stepText: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13.5,
    color:      '#2A2A2E',
    lineHeight: 1.5,
  },

  // Summary card
  summaryCard: {
    margin:       '0 16px 16px',
    padding:      '16px',
    background:   '#fff',
    borderRadius: 16,
    border:       '0.5px solid rgba(10,10,10,.08)',
  },
  summaryTitle: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.45)',
    marginBottom:  12,
  },
  orderLines: {
    display:       'flex',
    flexDirection: 'column',
    gap:           10,
    marginBottom:  12,
  },
  orderLine: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            12,
  },
  orderLineInfo: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    gap:           2,
  },
  orderLineName: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13.5,
    fontWeight: 600,
    color:      '#0A0A0A',
  },
  orderLineVars: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    letterSpacing: '.3px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.45)',
  },
  orderLineRight: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    flexShrink: 0,
  },
  orderLineQty: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      11,
    color:         'rgba(10,10,10,.4)',
  },
  orderLinePrice: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   13,
    fontWeight: 500,
    color:      '#0A0A0A',
  },
  divider: {
    height:    '0.5px',
    background: 'rgba(10,10,10,.08)',
    margin:    '10px 0',
  },
  grandDivider: {
    height:     1,
    background: 'rgba(10,10,10,.12)',
    margin:     '10px 0 8px',
  },
  totalRow: {
    display:        'flex',
    justifyContent: 'space-between',
    padding:        '3px 0',
  },
  totalLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13,
    color:      'rgba(10,10,10,.52)',
  },
  totalVal: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   13,
    color:      '#0A0A0A',
  },
  grandRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'baseline',
  },
  grandLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   15,
    fontWeight: 700,
    color:      '#0A0A0A',
  },
  grandVal: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      22,
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
  },

  // Footer
  contactNote: {
    textAlign:  'center',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13,
    color:      'rgba(10,10,10,.45)',
    padding:    '0 24px 16px',
  },
  emailLink: {
    color:          '#1B36C9',
    textDecoration: 'none',
    fontWeight:     500,
  },
  ctaWrap: {
    padding: '0 16px',
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
  },
};
