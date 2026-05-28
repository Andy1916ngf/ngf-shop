import { useEffect, useState }    from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot }        from 'firebase/firestore';
import { httpsCallable }          from 'firebase/functions';
import { IconArrowLeft }          from '@tabler/icons-react';
import { db, funcs }              from '../../firebase';
import { useAuth }                from '../../hooks/useAuth';

const captureOrderFn  = httpsCallable(funcs, 'captureOrder');
const markShippedFn   = httpsCallable(funcs, 'markShipped');
const markDeliveredFn = httpsCallable(funcs, 'markDelivered');
const cancelOrderFn   = httpsCallable(funcs, 'cancelOrder');

const STATUS_COLOR = {
  beställd:  { bg: '#FEF3C7', color: '#92400E' },
  bekräftad: { bg: '#DCE3FF', color: '#0C447C' },
  skickad:   { bg: '#EDE9FE', color: '#5B21B6' },
  levererad: { bg: '#D1FAE5', color: '#065F46' },
  avbruten:  { bg: '#FEE2E2', color: '#991B1B' },
};

const TIMELINE = ['beställd', 'bekräftad', 'skickad', 'levererad'];

function StatusTimeline({ status }) {
  const isCancelled = status === 'avbruten';
  const currentIdx  = TIMELINE.indexOf(status);

  return (
    <div style={s.timeline}>
      {TIMELINE.map((step, i) => {
        const past    = i < currentIdx;
        const current = i === currentIdx && !isCancelled;
        const future  = i > currentIdx;
        return (
          <div key={step} style={s.timelineStep}>
            <div style={{
              ...s.timelineDot,
              background:  (past || current) && !isCancelled ? '#1B36C9' : '#fff',
              border:      `2px solid ${(past || current) && !isCancelled ? '#1B36C9' : 'rgba(10,10,10,.15)'}`,
            }}>
              {(past || current) && !isCancelled && (
                <div style={s.timelineDotInner} />
              )}
            </div>
            {i < TIMELINE.length - 1 && (
              <div style={{
                ...s.timelineLine,
                background: past && !isCancelled ? '#1B36C9' : 'rgba(10,10,10,.1)',
              }} />
            )}
            <p style={{
              ...s.timelineLabel,
              color: (past || current) && !isCancelled
                ? '#0A0A0A' : 'rgba(10,10,10,.35)',
              fontWeight: current ? 700 : 500,
            }}>
              {step.charAt(0).toUpperCase() + step.slice(1)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div style={s.card}>
      <p style={s.cardTitle}>{title}</p>
      {children}
    </div>
  );
}

export default function OrderDetail() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { role }    = useAuth();
  const [order,   setOrder]   = useState(null);
  const [note,    setNote]    = useState('');
  const [working, setWorking] = useState(false);
  const [error,   setError]   = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Real-time order subscription — status updates appear immediately after actions
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'orders', id), snap => {
      if (snap.exists()) {
        const o = { id: snap.id, ...snap.data() };
        setOrder(o);
        setNote(o.adminNote || '');
      }
    });
    return unsub;
  }, [id]);

  async function runAction(fn, payload) {
    setError('');
    setWorking(true);
    try {
      await fn({ orderId: id, adminNote: note.trim() || undefined, ...payload });
      // onSnapshot will update the order status automatically
    } catch (err) {
      setError('Åtgärden misslyckades. Försök igen.');
      console.error(err);
    } finally {
      setWorking(false);
      setConfirmCancel(false);
    }
  }

  if (!order) {
    return <div style={s.loading}>Laddar order…</div>;
  }

  const sc        = STATUS_COLOR[order.status] || STATUS_COLOR.beställd;
  const subtotal  = (order.items || []).reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const isFinal   = order.status === 'levererad' || order.status === 'avbruten';

  return (
    <div style={s.page}>

      {/* Back + title */}
      <div style={s.topRow}>
        <button onClick={() => navigate('/admin/ordrar')} style={s.backBtn}>
          <IconArrowLeft size={16} /> Ordrar
        </button>
        <span style={{ ...s.statusBadge, background: sc.bg, color: sc.color }}>
          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </span>
      </div>

      <h1 style={s.orderId}>{order.id.slice(0, 8).toUpperCase()}</h1>

      {/* Status timeline */}
      {order.status !== 'avbruten' && (
        <InfoCard title="Status">
          <StatusTimeline status={order.status} />
        </InfoCard>
      )}

      {/* Customer */}
      <InfoCard title="Kund">
        <p style={s.infoRow}><span style={s.infoLabel}>Namn</span>
          <span style={s.infoVal}>{order.customerName || '—'}</span></p>
        <p style={s.infoRow}><span style={s.infoLabel}>E-post</span>
          <span style={s.infoVal}>{order.customerEmail || '—'}</span></p>
        <p style={s.infoRow}><span style={s.infoLabel}>Leverans</span>
          <span style={s.infoVal}>
            {order.deliveryMethod === 'delivery' ? 'Hemleverans' : 'Upphämtning vid träning'}
          </span></p>
      </InfoCard>

      {/* Items */}
      <InfoCard title="Varor">
        {(order.items || []).map((item, i) => {
          const varLabel = item.selectedVariations
            ? Object.values(item.selectedVariations).filter(Boolean).join(' · ')
            : null;
          return (
            <div key={i} style={s.itemRow}>
              <div>
                <p style={s.itemName}>{item.name}</p>
                {varLabel && <p style={s.itemVars}>{varLabel}</p>}
              </div>
              <div style={s.itemRight}>
                {item.quantity > 1 && (
                  <span style={s.itemQty}>×{item.quantity}</span>
                )}
                <span style={s.itemPrice}>
                  {Math.round(item.unitPrice * item.quantity / 100)} kr
                </span>
              </div>
            </div>
          );
        })}

        <div style={s.totDivider} />

        {order.discountAmount > 0 && (
          <div style={s.totRow}>
            <span style={s.totLabel}>
              Rabatt{order.couponCode ? ` (${order.couponCode})` : ''}
            </span>
            <span style={{ ...s.totVal, color: '#065F46' }}>
              −{Math.round(order.discountAmount / 100)} kr
            </span>
          </div>
        )}
        <div style={s.totRow}>
          <span style={s.totLabel}>Frakt</span>
          <span style={{ ...s.totVal, color: order.shippingCost === 0 ? '#065F46' : '#0A0A0A' }}>
            {order.shippingCost === 0 ? 'Gratis' : `${Math.round(order.shippingCost / 100)} kr`}
          </span>
        </div>
        <div style={{ ...s.totRow, marginTop: 4 }}>
          <span style={{ ...s.totLabel, fontWeight: 700, color: '#0A0A0A' }}>Totalt</span>
          <span style={{ ...s.totVal, fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontWeight: 700, fontSize: 18, letterSpacing: '-0.03em' }}>
            {Math.round(order.totalAmount / 100)} kr
          </span>
        </div>
      </InfoCard>

      {/* Admin note */}
      {!isFinal && (
        <InfoCard title="Meddelande till kund (valfritt)">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Bifogas med statusuppdateringen…"
            style={s.noteInput}
            rows={3}
          />
        </InfoCard>
      )}

      {/* Error */}
      {error && <p style={s.error} role="alert">{error}</p>}

      {/* Action buttons */}
      {!isFinal && (
        <div style={s.actions}>
          {order.status === 'beställd' && (
            <button
              disabled={working}
              onClick={() => runAction(captureOrderFn)}
              style={s.primaryBtn}>
              {working ? 'Bekräftar…' : 'Bekräfta order →'}
            </button>
          )}
          {order.status === 'bekräftad' && (
            <button
              disabled={working}
              onClick={() => runAction(markShippedFn)}
              style={s.primaryBtn}>
              {working ? 'Uppdaterar…' : 'Markera skickad →'}
            </button>
          )}
          {order.status === 'skickad' && (
            <button
              disabled={working}
              onClick={() => runAction(markDeliveredFn)}
              style={s.primaryBtn}>
              {working ? 'Uppdaterar…' : 'Markera levererad →'}
            </button>
          )}

          {/* Cancel — requires two-tap confirmation */}
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              style={s.cancelTrigger}>
              Avbryt order
            </button>
          ) : (
            <div style={s.cancelConfirm}>
              <p style={s.cancelWarning}>
                Bekräfta: Avbryta ordern och återbetala kunden?
              </p>
              <div style={s.cancelBtns}>
                <button onClick={() => setConfirmCancel(false)} style={s.cancelNo}>
                  Nej, behåll
                </button>
                <button
                  disabled={working}
                  onClick={() => runAction(cancelOrderFn)}
                  style={s.cancelYes}>
                  {working ? '…' : 'Ja, avbryt'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

const s = {
  loading: {
    padding:    40,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    color:      'rgba(10,10,10,.4)',
  },
  page:      { maxWidth: 600 },
  topRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  backBtn: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    background: 'none',
    border:     'none',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13,
    fontWeight: 500,
    color:      'rgba(10,10,10,.5)',
    cursor:     'pointer',
    padding:    0,
  },
  statusBadge: {
    padding:      '4px 10px',
    borderRadius: 999,
    fontSize:     11,
    fontWeight:   600,
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
  },
  orderId: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      22,
    fontWeight:    600,
    letterSpacing: '1px',
    color:         '#0A0A0A',
    marginBottom:  20,
  },

  // Timeline
  timeline: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        0,
    padding:    '4px 0 8px',
  },
  timelineStep: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    position:      'relative',
  },
  timelineDot: {
    width:          14,
    height:         14,
    borderRadius:   '50%',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         1,
  },
  timelineDotInner: {
    width:        6,
    height:       6,
    borderRadius: '50%',
    background:   '#fff',
  },
  timelineLine: {
    position:   'absolute',
    top:        7,
    left:       '50%',
    width:      '100%',
    height:     2,
    zIndex:     0,
  },
  timelineLabel: {
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     11,
    marginTop:    6,
    textAlign:    'center',
    lineHeight:   1.2,
  },

  // Cards
  card: {
    background:   '#fff',
    borderRadius: 14,
    border:       '0.5px solid rgba(10,10,10,.07)',
    padding:      '14px 16px',
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: '.8px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.4)',
    marginBottom:  10,
  },

  // Info rows
  infoRow: {
    display:   'flex',
    gap:       8,
    padding:   '3px 0',
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   11,
    color:      'rgba(10,10,10,.4)',
    minWidth:   60,
    paddingTop: 1,
  },
  infoVal: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13.5,
    color:      '#0A0A0A',
    fontWeight: 500,
  },

  // Item rows
  itemRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    padding:        '5px 0',
    gap:            12,
  },
  itemName: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13.5,
    fontWeight: 600,
    color:      '#0A0A0A',
    marginBottom: 2,
  },
  itemVars: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    letterSpacing: '.3px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.4)',
  },
  itemRight: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  itemQty: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   11,
    color:      'rgba(10,10,10,.4)',
  },
  itemPrice: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   13,
    color:      '#0A0A0A',
  },
  totDivider: {
    height:     '0.5px',
    background: 'rgba(10,10,10,.08)',
    margin:     '8px 0',
  },
  totRow:    { display: 'flex', justifyContent: 'space-between', padding: '3px 0' },
  totLabel:  { fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 13, color: 'rgba(10,10,10,.52)' },
  totVal:    { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#0A0A0A' },

  // Note
  noteInput: {
    width:        '100%',
    padding:      '10px 12px',
    borderRadius: 10,
    border:       '0.5px solid rgba(10,10,10,.1)',
    background:   '#F4F6FC',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    color:        '#0A0A0A',
    outline:      'none',
    resize:       'vertical',
  },

  error: {
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    color:        '#DC2626',
    fontWeight:   500,
    marginBottom: 10,
  },

  // Actions
  actions: { display: 'flex', flexDirection: 'column', gap: 10 },
  primaryBtn: {
    width:         '100%',
    height:        50,
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
  cancelTrigger: {
    background: 'none',
    border:     'none',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13,
    color:      'rgba(10,10,10,.4)',
    cursor:     'pointer',
    textAlign:  'center',
    padding:    '4px 0',
  },
  cancelConfirm: {
    background:   '#FEF2F2',
    borderRadius: 12,
    padding:      '14px 16px',
    border:       '0.5px solid rgba(220,38,38,.2)',
  },
  cancelWarning: {
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    color:        '#991B1B',
    marginBottom: 12,
    fontWeight:   500,
  },
  cancelBtns: { display: 'flex', gap: 8 },
  cancelNo: {
    flex:         1,
    height:       40,
    borderRadius: 999,
    border:       '0.5px solid rgba(10,10,10,.12)',
    background:   '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    fontWeight:   600,
    cursor:       'pointer',
  },
  cancelYes: {
    flex:         1,
    height:       40,
    borderRadius: 999,
    border:       'none',
    background:   '#DC2626',
    color:        '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    fontWeight:   700,
    cursor:       'pointer',
  },
};
