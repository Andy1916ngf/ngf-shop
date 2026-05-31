
import { useEffect, useState }                              from 'react';
import { collection, query, orderBy, getDocs }             from 'firebase/firestore';
import { useNavigate }                                       from 'react-router-dom';
import { db }                                                from '../../firebase';

const STATUS_COLOR = {
  beställd:  { bg: '#FEF3C7', color: '#92400E' },
  bekräftad: { bg: '#DCE3FF', color: '#0C447C' },
  skickad:   { bg: '#EDE9FE', color: '#5B21B6' },
  levererad: { bg: '#D1FAE5', color: '#065F46' },
  avbruten:  { bg: '#FEE2E2', color: '#991B1B' },
  tvist:     { bg: '#FFE4E6', color: '#9F1239' },
};

const STATUS_LABEL = {
  beställd:  'Beställd',
  bekräftad: 'Bekräftad',
  skickad:   'Skickad',
  levererad: 'Levererad',
  avbruten:  'Avbruten',
  tvist:     'Tvist',
};

const TABS = ['alla', 'beställd', 'bekräftad', 'skickad', 'levererad', 'avbruten'];
const TAB_LABEL = { alla: 'Alla', ...STATUS_LABEL };

function fmt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Orders() {
  const navigate              = useNavigate();
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('alla');

  async function loadOrders() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      );
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, []);

  const visible = tab === 'alla'
    ? orders
    : orders.filter(o => o.status === tab);

  return (
    <div>
      {/* Page header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Ordrar</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={s.count}>{visible.length}</span>
          <button
            onClick={loadOrders}
            disabled={loading}
            style={s.refreshBtn}
            aria-label="Uppdatera ordrar">
            {loading ? '…' : '↻'}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...s.tab, ...(t === tab ? s.tabActive : s.tabIdle) }}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Order list */}
      {loading ? (
        <p style={s.empty}>Laddar ordrar…</p>
      ) : visible.length === 0 ? (
        <p style={s.empty}>Inga ordrar.</p>
      ) : (
        <div style={s.list}>
          {visible.map(order => {
            const sc = STATUS_COLOR[order.status] || STATUS_COLOR.beställd;
            const name = order.customerName || order.customerEmail || '—';
            const itemCount = order.items?.length || 0;
            return (
              <div
                key={order.id}
                style={s.card}
                onClick={() => navigate(`/admin/ordrar/${order.id}`)}>
                <div style={s.cardTop}>
                  <div>
                    <p style={s.customerName}>{name}</p>
                    <p style={s.orderId}>
                      {order.merchantReference || order.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <span style={{ ...s.statusBadge, background: sc.bg, color: sc.color }}>
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>
                <div style={s.cardBottom}>
                  <span style={s.meta}>{fmt(order.createdAt)}</span>
                  <span style={s.meta}>
                    {itemCount} {itemCount === 1 ? 'vara' : 'varor'}
                  </span>
                  <span style={s.total}>
                    {Math.round((order.totalAmount || 0) / 100)} kr
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  pageHeader: {
    display:     'flex',
    alignItems:  'center',
    gap:         10,
    marginBottom: 16,
  },
  refreshBtn: {
    width:        32,
    height:       32,
    borderRadius: '50%',
    border:       '0.5px solid rgba(10,10,10,.12)',
    background:   '#fff',
    fontSize:     16,
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    color:        '#1B36C9',
  },
  pageTitle: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      22,
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
  },
  count: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      12,
    color:         'rgba(10,10,10,.4)',
  },
  tabs: {
    display:    'flex',
    gap:        4,
    marginBottom: 16,
    flexWrap:   'wrap',
  },
  tab: {
    padding:      '6px 12px',
    borderRadius: 999,
    fontSize:     12,
    fontWeight:   600,
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    cursor:       'pointer',
    border:       'none',
    transition:   'background 0.12s',
  },
  tabActive: { background: '#0A0A0A', color: '#fff' },
  tabIdle:   { background: 'rgba(10,10,10,.07)', color: 'rgba(10,10,10,.6)' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    background:   '#fff',
    borderRadius: 14,
    border:       '0.5px solid rgba(10,10,10,.07)',
    padding:      '14px 16px',
    cursor:       'pointer',
    transition:   'box-shadow 0.12s',
  },
  cardTop: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   10,
    gap:            8,
  },
  customerName: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   14,
    fontWeight: 600,
    color:      '#0A0A0A',
    marginBottom: 2,
  },
  orderId: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    letterSpacing: '.5px',
    color:         'rgba(10,10,10,.4)',
  },
  statusBadge: {
    padding:      '4px 10px',
    borderRadius: 999,
    fontSize:     11,
    fontWeight:   600,
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    flexShrink:   0,
  },
  cardBottom: {
    display:    'flex',
    alignItems: 'center',
    gap:        12,
  },
  meta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   10.5,
    color:      'rgba(10,10,10,.4)',
    letterSpacing: '.2px',
  },
  total: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      13,
    fontWeight:    500,
    color:         '#0A0A0A',
    marginLeft:    'auto',
  },
  empty: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   14,
    color:      'rgba(10,10,10,.4)',
    padding:    '32px 0',
    textAlign:  'center',
  },
};
