import { useEffect, useState }       from 'react';
import { collection, getDocs,
         doc, updateDoc }            from 'firebase/firestore';
import { useNavigate }               from 'react-router-dom';
import { IconEye, IconEyeOff,
         IconPencil, IconPlus }      from '@tabler/icons-react';
import { db }                        from '../../firebase';

const TONES = [
  { bg: '#1B36C9', stripe: 'rgba(255,255,255,.065)' },
  { bg: '#0A0A0A', stripe: 'rgba(255,255,255,.045)' },
  { bg: '#F4F6FC', stripe: 'rgba(10,10,10,.04)'     },
  { bg: '#DCE3FF', stripe: 'rgba(10,10,10,.035)'    },
];

function MiniTile({ index }) {
  const t = TONES[index % 4];
  return (
    <div style={{
      width:        52,
      height:       52,
      borderRadius: 8,
      flexShrink:   0,
      background:   `repeating-linear-gradient(135deg, ${t.bg} 0 8px, ${t.stripe} 8px 16px), ${t.bg}`,
    }} />
  );
}

export default function Products() {
  const navigate              = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  async function load() {
    // Direct Firestore read — rules allow admin reads of all products including hidden
    const snap = await getDocs(collection(db, 'products'));
    const prods = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'sv'));
    setProducts(prods);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleVisibility(product) {
    // Direct Firestore write for a single field — admin can write via rules
    await updateDoc(doc(db, 'products', product.id), {
      visible: !product.visible,
    });
    setProducts(prev =>
      prev.map(p => p.id === product.id ? { ...p, visible: !p.visible } : p)
    );
  }

  const visible  = products.filter(p => p.visible);
  const hidden   = products.filter(p => !p.visible);

  return (
    <div>
      {/* Header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Produkter</h1>
        <button
          onClick={() => navigate('/admin/produkter/ny')}
          style={s.newBtn}>
          <IconPlus size={14} /> Ny produkt
        </button>
      </div>

      {loading ? (
        <p style={s.empty}>Laddar produkter…</p>
      ) : products.length === 0 ? (
        <p style={s.empty}>Inga produkter ännu.</p>
      ) : (
        <>
          <ProductList
            products={visible}
            title={`Synliga (${visible.length})`}
            navigate={navigate}
            onToggle={toggleVisibility}
          />
          {hidden.length > 0 && (
            <ProductList
              products={hidden}
              title={`Dolda (${hidden.length})`}
              navigate={navigate}
              onToggle={toggleVisibility}
              dim
            />
          )}
        </>
      )}
    </div>
  );
}

function ProductList({ products, title, navigate, onToggle, dim }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={s.groupTitle}>{title}</p>
      <div style={s.list}>
        {products.map((p, i) => (
          <div key={p.id} style={{ ...s.card, opacity: dim ? 0.5 : 1 }}>
            {p.images?.[0] ? (
              <img src={p.images[0]} alt={p.name} style={s.thumb} />
            ) : (
              <MiniTile index={i} />
            )}

            <div style={s.info}>
              <p style={s.name}>{p.name}</p>
              <p style={s.meta}>
                {p.category}
                {p.variations?.colours && <> · Färger</>}
                {p.variations?.sizes   && <> · Storlekar</>}
              </p>
            </div>

            <div style={s.right}>
              <p style={s.price}>{Math.round(p.price / 100)} kr</p>
              <div style={s.actions}>
                <button
                  onClick={() => onToggle(p)}
                  style={s.iconBtn}
                  aria-label={p.visible ? 'Dölj produkt' : 'Visa produkt'}>
                  {p.visible
                    ? <IconEye size={16} />
                    : <IconEyeOff size={16} />}
                </button>
                <button
                  onClick={() => navigate(`/admin/produkter/${p.id}`)}
                  style={s.iconBtn}
                  aria-label="Redigera produkt">
                  <IconPencil size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  pageHeader: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   16,
  },
  pageTitle: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      22,
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
  },
  newBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '8px 16px',
    borderRadius: 999,
    border:       'none',
    background:   '#1B36C9',
    color:        '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    fontWeight:   600,
    cursor:       'pointer',
  },
  groupTitle: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: '.8px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.4)',
    marginBottom:  8,
  },
  list:  { display: 'flex', flexDirection: 'column', gap: 6 },
  card: {
    background:   '#fff',
    borderRadius: 12,
    border:       '0.5px solid rgba(10,10,10,.07)',
    padding:      10,
    display:      'flex',
    alignItems:   'center',
    gap:          12,
  },
  thumb: {
    width:        52,
    height:       52,
    borderRadius: 8,
    objectFit:    'cover',
    flexShrink:   0,
  },
  info:  { flex: 1, minWidth: 0 },
  name: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   14,
    fontWeight: 600,
    color:      '#0A0A0A',
    marginBottom: 3,
    overflow:   'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   10,
    letterSpacing: '.3px',
    color:      'rgba(10,10,10,.4)',
  },
  right:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  price: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   13,
    fontWeight: 500,
    color:      '#0A0A0A',
  },
  actions: { display: 'flex', gap: 4 },
  iconBtn: {
    width:        30,
    height:       30,
    borderRadius: 8,
    border:       'none',
    background:   'rgba(10,10,10,.06)',
    color:        'rgba(10,10,10,.55)',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    cursor:       'pointer',
  },
  empty: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   14,
    color:      'rgba(10,10,10,.4)',
    padding:    '32px 0',
    textAlign:  'center',
  },
};
