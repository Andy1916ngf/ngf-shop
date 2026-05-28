import { useEffect, useState }        from 'react';
import { httpsCallable }              from 'firebase/functions';
import { doc, getDoc }                from 'firebase/firestore';
import { Link, useNavigate,
         useSearchParams }            from 'react-router-dom';
import { funcs, db }                  from '../../firebase';
import { useBasketCtx }               from '../../context/BasketContext';
import { useLangCtx }                 from '../../context/LangContext';

const getProductsFn = httpsCallable(funcs, 'getProducts');

// Diagonal stripe tile tones — cycles across products without images
const TONES = ['', 'tone-dark', 'tone-light', 'tone-sky'];

// ── Hero section ──────────────────────────────────────────────

function Hero({ hero }) {
  if (!hero || hero.type === 'none') return null;

  let content;

  if (hero.imageUrl) {
    // Image hero — object-fit: cover crops oversized images from centre.
    // Recommended upload: at least 1200px wide. Undersized images will stretch.
    content = (
      <div style={s.heroImgWrap}>
        <img
          src={hero.imageUrl}
          alt={hero.headline || 'Kampanjbanner'}
          style={s.heroImg}
        />
      </div>
    );
  } else {
    // Default: editorial text layout
    content = (
      <div style={s.hero}>
        {hero.subheadline && (
          <p style={s.heroSub}>{hero.subheadline}</p>
        )}
        {hero.headline && (
          <h1 style={s.heroH1}>
            {hero.headline}
            {hero.heroItalic && (
              <><br /><em style={s.heroEm}>{hero.heroItalic}</em></>
            )}
          </h1>
        )}
      </div>
    );
  }

  if (hero.linkUrl) {
    return (
      <a href={hero.linkUrl} style={s.heroLink} aria-label={hero.headline || 'Hero-länk'}>
        {content}
      </a>
    );
  }
  return content;
}

// ── Product card ──────────────────────────────────────────────

function ProductCard({ product, toneIndex, onAdd }) {
  const navigate    = useNavigate();
  const hasVariants = !!(
    product.variations?.colours ||
    product.variations?.sizes   ||
    product.variations?.customText
  );
  const tone = TONES[toneIndex % 4];

  function handleAdd(e) {
    e.preventDefault();
    // Products with variations must go to detail page for selection
    if (hasVariants) {
      navigate(`/produkt/${product.id}`);
    } else {
      onAdd(product.id, null);
    }
  }

  return (
    <div style={s.card}>
      <Link to={`/produkt/${product.id}`} style={{ textDecoration: 'none', display: 'block', position: 'relative' }}>
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            style={s.cardImg}
            loading="lazy"
          />
        ) : (
          <div className={`stripe-tile ${tone}`} style={s.cardTile}>
            <div className="tile-lbl" style={s.tileLabel}>
              <span>{product.name}</span>
              <span>img</span>
            </div>
          </div>
        )}
        {product.onSale && <span style={s.saleBadge}>REA</span>}
      </Link>

      <div style={s.cardBody}>
        <Link to={`/produkt/${product.id}`} style={s.cardName}>
          {product.name}
        </Link>
        <div style={s.cardFooter}>
          <span style={s.cardPrice}>
            {Math.round(product.price / 100)} kr
            {product.onSale && product.originalPrice && (
              <span style={s.cardOriginalPrice}>
                {' '}{Math.round(product.originalPrice / 100)} kr
              </span>
            )}
          </span>
          <button
            onClick={handleAdd}
            style={s.addBtn}
            aria-label={
              hasVariants
                ? `Välj varianter för ${product.name}`
                : `Lägg ${product.name} i korgen`
            }>
            {hasVariants ? '→' : '+'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Catalog ───────────────────────────────────────────────────

export default function Catalog() {
  const [products,  setProducts]  = useState([]);
  const [config,    setConfig]    = useState(null);
  const [category,  setCategory]  = useState('all');
  const [loading,   setLoading]   = useState(true);
  const { addItem }  = useBasketCtx();
  const { t }        = useLangCtx();
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery    = searchParams.get('q')?.trim().toLowerCase() || '';

  useEffect(() => {
    Promise.all([
      getProductsFn().then(res => res.data),
      getDoc(doc(db, 'config', 'site')).then(snap =>
        snap.exists() ? snap.data() : null
      ),
    ])
      .then(([prods, cfg]) => { setProducts(prods); setConfig(cfg); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Derive category list from actual products
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = (category === 'all'
    ? products
    : products.filter(p => p.category === category)
  )
    .filter(p =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery) ||
      (p.description || '').toLowerCase().includes(searchQuery)
    )
    .slice()
    .sort((a, b) => (b.onSale ? 1 : 0) - (a.onSale ? 1 : 0));

  // Map category keys to i18n labels
  const catLabel = c => ({
    all:        t.catalog.all,
    Kläder:     t.catalog.clothes,
    Utrustning: t.catalog.equipment,
    Tillbehör:  t.catalog.accessories,
  }[c] ?? c);

  if (loading) return <div className="loading">Laddar produkter…</div>;

  return (
    <main>
      {/* Hero / splash section */}
      <Hero hero={config?.hero} />

      {/* Search result header — shown when ?q= is active */}
      {searchQuery && (
        <div style={s.searchHeader}>
          <p style={s.searchLabel}>
            Sökresultat för <strong>"{searchParams.get('q').trim()}"</strong>
            {' '}
            <span style={s.searchCount}>({filtered.length})</span>
          </p>
          <button
            onClick={() => navigate('/')}
            style={s.clearSearch}
            aria-label="Rensa sökning">
            Rensa ×
          </button>
        </div>
      )}

      {/* Category filter chips */}
      <div className="chip-row" role="group" aria-label="Filtrera efter kategori">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={c === category}
            style={{
              ...s.chip,
              ...(c === category ? s.chipOn : s.chipOff),
            }}>
            {catLabel(c)}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <p style={s.empty}>Inga produkter hittades.</p>
      ) : (
        <div className="product-grid">
          {filtered.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              toneIndex={i}
              onAdd={addItem}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = {
  // Hero — text
  hero: {
    padding: '22px 20px 6px',
  },
  // Hero — image
  heroImgWrap: {
    width:    '100%',
    overflow: 'hidden',
  },
  heroImg: {
    width:          '100%',
    height:         'clamp(200px, 40vw, 380px)',
    objectFit:      'cover',      // crops oversized images from centre; no distortion
    objectPosition: 'center',
    display:        'block',
  },
  heroLink: {
    display:        'block',
    textDecoration: 'none',
    color:          'inherit',
  },
  heroSub: {
    fontFamily:    "'JetBrains Mono', 'Courier New', monospace",
    fontSize:      10,
    letterSpacing: '1.4px',
    textTransform: 'uppercase',
    color:         '#1B36C9',
    fontWeight:    600,
    marginBottom:  6,
  },
  heroH1: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      'clamp(30px, 8vw, 44px)',
    lineHeight:    0.93,
    letterSpacing: '-0.05em',
    color:         '#0A0A0A',
  },
  heroEm: {
    fontStyle:  'italic',
    fontWeight: 500,
  },

  // Search result strip
  searchHeader: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '10px 20px 0',
    gap:            8,
  },
  searchLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13,
    color:      'rgba(10,10,10,.55)',
  },
  searchCount: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   11,
    color:      'rgba(10,10,10,.4)',
  },
  clearSearch: {
    background:  'none',
    border:      'none',
    fontFamily:  "'Space Grotesk', system-ui, sans-serif",
    fontSize:    12.5,
    fontWeight:  600,
    color:       '#1B36C9',
    cursor:      'pointer',
    flexShrink:  0,
    padding:     0,
  },

  // Chips
  chip: {
    flexShrink:  0,
    padding:     '7px 14px',
    borderRadius: 999,
    fontSize:    12.5,
    fontWeight:  600,
    fontFamily:  "'Space Grotesk', system-ui, sans-serif",
    cursor:      'pointer',
    transition:  'background 0.15s, color 0.15s',
    border:      'none',
  },
  chipOn: {
    background: '#DCE3FF',          // sky blue
    color:      '#0C447C',          // Blue-800 — dark enough on sky for contrast
    border:     '1px solid #B5D4F4',
  },
  chipOff: {
    background: 'transparent',
    color:      '#0A0A0A',
    border:     '1px solid rgba(10,10,10,0.12)',
  },

  // Cards
  card: {
    background:   '#fff',
    borderRadius: 14,
    overflow:     'hidden',
    border:       '0.5px solid rgba(10,10,10,0.055)',
  },
  saleBadge: {
    position:      'absolute',
    top:           8,
    left:          8,
    background:    '#DC2626',
    color:         '#fff',
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      9,
    fontWeight:    700,
    letterSpacing: '1px',
    padding:       '3px 7px',
    borderRadius:  999,
  },
  cardImg: {
    width:      '100%',
    height:     160,
    objectFit:  'cover',
    display:    'block',
  },
  cardTile: {
    height:   160,
    position: 'relative',
  },
  tileLabel: {
    position:       'absolute',
    bottom:         8,
    left:           10,
    right:          10,
    fontFamily:     "'JetBrains Mono', monospace",
    fontSize:       9,
    letterSpacing:  '0.5px',
    textTransform:  'uppercase',
    display:        'flex',
    justifyContent: 'space-between',
  },
  cardBody: {
    padding: '10px 11px 12px',
  },
  cardName: {
    display:        'block',
    fontSize:       13,
    fontWeight:     600,
    letterSpacing:  '-0.1px',
    color:          '#0A0A0A',
    textDecoration: 'none',
    marginBottom:   6,
    lineHeight:     1.3,
  },
  cardFooter: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
  },
  cardPrice: {
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    fontSize:   12.5,
    color:      '#2A2A2E',
    fontWeight: 500,
  },
  cardOriginalPrice: {
    textDecoration: 'line-through',
    color:          'rgba(10,10,10,.35)',
    fontSize:       11,
    marginLeft:     3,
  },
  addBtn: {
    width:           27,
    height:          27,
    borderRadius:    8,
    border:          'none',
    background:      '#1B36C9',
    color:           '#fff',
    fontSize:        16,
    fontWeight:      500,
    cursor:          'pointer',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    lineHeight:      1,
    fontFamily:      "'Space Grotesk', system-ui, sans-serif",
  },

  empty: {
    padding:    '48px 20px',
    color:      'rgba(10,10,10,0.4)',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   14,
    textAlign:  'center',
  },
};
