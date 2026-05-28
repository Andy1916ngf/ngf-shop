import { useEffect, useState }                       from 'react';
import { useParams, useNavigate }                    from 'react-router-dom';
import { doc, getDoc }                               from 'firebase/firestore';
import { IconArrowLeft, IconHeart,
         IconChevronLeft, IconChevronRight }         from '@tabler/icons-react';
import { db }                                        from '../../firebase';
import { useBasketCtx }                              from '../../context/BasketContext';
import { useLangCtx }                                from '../../context/LangContext';

// ── Stripe tile (no-image fallback) ──────────────────────────

const TONES = [
  { bg: '#1B36C9', stripe: 'rgba(255,255,255,.065)', light: false },
  { bg: '#0A0A0A', stripe: 'rgba(255,255,255,.045)', light: false },
  { bg: '#F4F6FC', stripe: 'rgba(10,10,10,.04)',     light: true  },
  { bg: '#DCE3FF', stripe: 'rgba(10,10,10,.035)',    light: true  },
];

function StripeTile({ seed = 0 }) {
  const t = TONES[seed % 4];
  return (
    <div style={{
      width:      '100%',
      height:     '100%',
      background: `repeating-linear-gradient(135deg, ${t.bg} 0 13px, ${t.stripe} 13px 26px), ${t.bg}`,
      position:   'relative',
    }}>
      <span style={{
        position:      'absolute',
        bottom:        12,
        left:          14,
        fontFamily:    "'JetBrains Mono', monospace",
        fontSize:      9,
        letterSpacing: '.5px',
        textTransform: 'uppercase',
        color:         t.light ? 'rgba(10,10,10,.35)' : 'rgba(255,255,255,.4)',
      }}>
        Produktbild
      </span>
    </div>
  );
}

// ── Colour swatch ─────────────────────────────────────────────

const COLOUR_HEX = {
  'Marinblå': '#1B36C9', 'Svart': '#0A0A0A', 'Vit': '#FFFFFF',
  'Röd': '#DC2626', 'Grön': '#16A34A', 'Grå': '#9CA3AF',
  'Gul': '#FBBF24', 'Orange': '#EA580C', 'Rosa': '#EC4899',
};

function ColourSwatch({ colour, selected, onSelect }) {
  const hex     = COLOUR_HEX[colour] || '#888';
  const isLight = ['#FFFFFF', '#F4F6FC', '#DCE3FF', '#9CA3AF', '#FBBF24'].includes(hex);
  return (
    <button
      onClick={() => onSelect(colour)}
      aria-label={colour}
      aria-pressed={selected}
      title={colour}
      style={{
        ...s.swatch,
        background: hex,
        border:     selected
          ? `2px solid #0A0A0A`
          : `1px solid ${isLight ? 'rgba(10,10,10,.2)' : 'transparent'}`,
        padding:    selected ? 2 : 3,
      }}>
      {selected && (
        <div style={{
          width:        '100%',
          height:       '100%',
          borderRadius: 7,
          background:   hex,
          border:       `2px solid ${isLight ? 'rgba(10,10,10,.2)' : '#fff'}`,
        }} />
      )}
    </button>
  );
}

// ── Size pill ─────────────────────────────────────────────────

function SizePill({ size, selected, onSelect, outOfStock }) {
  return (
    <button
      onClick={() => !outOfStock && onSelect(size)}
      aria-label={size}
      aria-pressed={selected}
      disabled={outOfStock}
      style={{
        ...s.sizePill,
        ...(selected   ? s.sizePillOn  : s.sizePillOff),
        ...(outOfStock ? s.sizePillOut : {}),
      }}>
      {size}
    </button>
  );
}

// ── Added confirmation bar ────────────────────────────────────

function AddedBar({ selectedSummary, onContinue, onCheckout, t }) {
  return (
    <div style={s.addedBar}>
      <p style={s.addedText}>✓ {t.product.addedToBag}</p>
      {selectedSummary && (
        <p style={s.addedSummary}>{selectedSummary}</p>
      )}
      <div style={s.addedActions}>
        <button onClick={onContinue} style={s.addedSecondary}>
          {t.product.continueShopping}
        </button>
        <button onClick={onCheckout} style={s.addedPrimary}>
          {t.product.toCheckout} →
        </button>
      </div>
    </div>
  );
}

// ── Product detail ────────────────────────────────────────────

export default function Product() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { addItem } = useBasketCtx();
  const { t }       = useLangCtx();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [colour,  setColour]  = useState(null);
  const [size,    setSize]    = useState(null);
  const [text,    setText]    = useState('');
  const [imgIdx,  setImgIdx]  = useState(0);
  const [error,   setError]   = useState('');
  const [added,   setAdded]   = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'products', id))
      .then(snap => {
        if (!snap.exists()) { navigate('/'); return; }
        const p = { id: snap.id, ...snap.data() };
        setProduct(p);
        if (p.variations?.colours?.length) setColour(p.variations.colours[0]);
        if (p.variations?.sizes?.length)   setSize(p.variations.sizes[0]);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id]);

  // Reset image index whenever displayed images change (e.g. colour switch)
  useEffect(() => { setImgIdx(0); }, [colour]);

  if (loading) return <div className="loading">Laddar produkt…</div>;
  if (!product) return null;

  // ── Image resolution ─────────────────────────────────────
  // Priority 1: colour-mapped image (imagesByColour[selectedColour])
  // Priority 2: general image array (product.images)
  // Priority 3: diagonal stripe tile
  const displayImages = (() => {
    if (product.imagesByColour && colour && product.imagesByColour[colour]) {
      return [product.imagesByColour[colour]];
    }
    return product.images?.filter(Boolean) || [];
  })();
  const hasImages  = displayImages.length > 0;
  const multiImage = displayImages.length > 1;

  function prevImg() {
    setImgIdx(i => (i - 1 + displayImages.length) % displayImages.length);
  }
  function nextImg() {
    setImgIdx(i => (i + 1) % displayImages.length);
  }

  const hasColours = product.variations?.colours?.length > 0;
  const hasSizes   = product.variations?.sizes?.length   > 0;
  const hasText    = product.variations?.customText;

  // Summary string shown in the confirmation bar
  const selectionSummary = [colour, size, text.trim() || null]
    .filter(Boolean).join(' · ') || null;

  function handleAdd() {
    setError('');
    if (hasColours && !colour) { setError('Välj en färg');    return; }
    if (hasSizes   && !size)   { setError('Välj en storlek'); return; }
    addItem(product.id, {
      colour:     colour || null,
      size:       size   || null,
      customText: hasText ? text.trim() || null : null,
    });
    setAdded(true);
  }

  // Determine back-button / nav icon colour based on image bg
  const overlayLight = !hasImages; // stripe tile is always coloured → white icons

  return (
    <main style={s.page}>

      {/* ── Image area ─────────────────────────────────── */}
      <div style={s.imageArea}>
        {hasImages ? (
          <img
            src={displayImages[imgIdx]}
            alt={product.name}
            style={s.image}
          />
        ) : (
          <StripeTile seed={0} />
        )}

        {/* Back + favourite — top corners */}
        <div style={s.topNav}>
          <button
            onClick={() => navigate(-1)}
            style={{ ...s.overlayBtn, background: overlayLight ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)', color: '#fff' }}
            aria-label={t.product.back}>
            <IconArrowLeft size={16} />
          </button>
          <button
            style={{ ...s.overlayBtn, background: overlayLight ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)', color: '#fff' }}
            aria-label="Spara som favorit">
            <IconHeart size={16} />
          </button>
        </div>

        {/* REA badge */}
        {product.onSale && <span style={s.saleBadge}>REA</span>}

        {/* Round-robin nav — centred vertically, only when multiple images */}
        {multiImage && (
          <div style={s.imgNavRow}>
            <button onClick={prevImg} style={s.imgNavBtn} aria-label="Föregående bild">
              <IconChevronLeft size={16} />
            </button>
            <span style={s.imgNavCount}>{imgIdx + 1} / {displayImages.length}</span>
            <button onClick={nextImg} style={s.imgNavBtn} aria-label="Nästa bild">
              <IconChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom sheet ────────────────────────────────── */}
      <div style={s.sheet}>

        <div style={s.sheetHeader}>
          <div>
            <p style={s.category}>{product.category}</p>
            <h1 style={s.name}>{product.name}</h1>
          </div>
          <div style={s.priceBlock}>
            <span style={{
              ...s.price,
              color: product.onSale ? '#DC2626' : '#0A0A0A',
            }}>
              {Math.round(product.price / 100)} kr
            </span>
            {product.onSale && product.originalPrice && (
              <span style={s.originalPrice}>
                {Math.round(product.originalPrice / 100)} kr
              </span>
            )}
            <span style={s.vat}>{t.product.inclVat}</span>
          </div>
        </div>

        {product.description && (
          <p style={s.description}>{product.description}</p>
        )}

        {/* Colour */}
        {hasColours && (
          <div style={s.section}>
            <p style={s.sectionLabel}>
              {t.product.colour}
              {colour && <span style={s.selectedValue}> · {colour}</span>}
            </p>
            <div style={s.swatchRow}>
              {product.variations.colours.map(c => (
                <ColourSwatch
                  key={c}
                  colour={c}
                  selected={colour === c}
                  onSelect={setColour}
                />
              ))}
            </div>
          </div>
        )}

        {/* Size */}
        {hasSizes && (
          <div style={s.section}>
            <p style={s.sectionLabel}>
              {t.product.size}
              {size && <span style={s.selectedValue}> · {size}</span>}
              {product.sizeGuideUrl && (
                <a
                  href={product.sizeGuideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.sizeGuideLink}>
                  {t.product.sizeGuide} →
                </a>
              )}
            </p>
            <div style={s.pillRow}>
              {product.variations.sizes.map(sz => (
                <SizePill
                  key={sz}
                  size={sz}
                  selected={size === sz}
                  onSelect={setSize}
                />
              ))}
            </div>
          </div>
        )}

        {/* Custom text */}
        {hasText && (
          <div style={s.section}>
            <p style={s.sectionLabel}>
              {t.product.customText}
              <span style={s.hint}> · {t.product.customTextHint}</span>
            </p>
            <div style={s.textWrap}>
              <input
                value={text}
                onChange={e => setText(e.target.value.slice(0, 20))}
                placeholder="Ex. Hanna · #7"
                style={s.textInput}
                aria-label="Anpassad text"
                maxLength={20}
              />
              <span style={s.charCount}>{text.length}/20</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <p style={s.error} role="alert">{error}</p>}

        {/* CTA or confirmation */}
        {added ? (
          <AddedBar
            t={t}
            selectedSummary={selectionSummary}
            onContinue={() => { setAdded(false); navigate('/'); }}
            onCheckout={() => navigate('/varukorg')}
          />
        ) : (
          <button onClick={handleAdd} style={s.cta}>
            {t.product.addToBag}
          </button>
        )}

      </div>
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = {
  page: {
    minHeight:     '100vh',
    display:       'flex',
    flexDirection: 'column',
  },
  imageArea: {
    position:   'relative',
    height:     '42vh',
    minHeight:  220,
    maxHeight:  420,
    flexShrink: 0,
    overflow:   'hidden',
  },
  image: {
    width:           '100%',
    height:          '100%',
    objectFit:       'cover',
    objectPosition:  'center',
    display:         'block',
  },
  topNav: {
    position:       'absolute',
    top:            14,
    left:           16,
    right:          16,
    display:        'flex',
    justifyContent: 'space-between',
  },
  overlayBtn: {
    width:           40,
    height:          40,
    borderRadius:    '50%',
    border:          'none',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    cursor:          'pointer',
  },
  imgNavRow: {
    position:       'absolute',
    bottom:         14,
    left:           0,
    right:          0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
  },
  imgNavBtn: {
    width:           34,
    height:          34,
    borderRadius:    '50%',
    border:          'none',
    background:      'rgba(255,255,255,0.22)',
    color:           '#fff',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    cursor:          'pointer',
  },
  imgNavCount: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      11,
    color:         'rgba(255,255,255,0.7)',
    letterSpacing: '.4px',
  },

  // Sheet
  sheet: {
    flex:         1,
    background:   '#fff',
    borderRadius: '22px 22px 0 0',
    marginTop:    -20,
    position:     'relative',
    zIndex:       2,
    padding:      '20px 20px 40px',
  },
  sheetHeader: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   10,
    gap:            12,
  },
  category: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.52)',
    marginBottom:  5,
  },
  name: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      26,
    letterSpacing: '-0.04em',
    lineHeight:    1.05,
    color:         '#0A0A0A',
  },
  saleBadge: {
    position:      'absolute',
    bottom:        14,
    left:          16,
    background:    '#DC2626',
    color:         '#fff',
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: '1.2px',
    padding:       '4px 10px',
    borderRadius:  999,
  },
  priceBlock: {
    textAlign:  'right',
    flexShrink: 0,
  },
  price: {
    display:       'block',
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      22,
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
  },
  originalPrice: {
    display:        'block',
    fontFamily:     "'JetBrains Mono', monospace",
    fontSize:       12,
    color:          'rgba(10,10,10,.4)',
    textDecoration: 'line-through',
    marginTop:      2,
  },
  vat: {
    display:    'block',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   10,
    color:      'rgba(10,10,10,.45)',
    marginTop:  2,
  },
  description: {
    fontSize:     13,
    lineHeight:   1.6,
    color:        'rgba(10,10,10,.52)',
    marginBottom: 18,
  },

  section: { marginBottom: 18 },
  sectionLabel: {
    fontSize:     13,
    fontWeight:   600,
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    color:        '#0A0A0A',
    marginBottom: 10,
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    flexWrap:     'wrap',
  },
  selectedValue: {
    fontWeight: 500,
    color:      'rgba(10,10,10,.52)',
  },
  hint: {
    fontWeight: 400,
    fontSize:   11.5,
    color:      'rgba(10,10,10,.45)',
  },
  sizeGuideLink: {
    marginLeft:     'auto',
    fontSize:       11.5,
    fontWeight:     500,
    color:          '#1B36C9',
    textDecoration: 'none',
    letterSpacing:  '-0.01em',
    whiteSpace:     'nowrap',
  },

  swatchRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  swatch: {
    width:        38,
    height:       38,
    borderRadius: 10,
    cursor:       'pointer',
    flexShrink:   0,
  },

  pillRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  sizePill: {
    padding:    '7px 12px',
    borderRadius: 10,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   12,
    fontWeight: 600,
    cursor:     'pointer',
    border:     'none',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  },
  sizePillOn:  { background: '#0A0A0A', color: '#fff' },
  sizePillOff: { background: '#F4F6FC', color: '#0A0A0A', border: '1px solid rgba(10,10,10,.08)' },
  sizePillOut: { opacity: 0.35, cursor: 'not-allowed', textDecoration: 'line-through' },

  textWrap:  { position: 'relative' },
  textInput: {
    width:        '100%',
    padding:      '12px 48px 12px 14px',
    borderRadius: 12,
    border:       '1px solid rgba(10,10,10,.1)',
    background:   '#F4F6FC',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    color:        '#0A0A0A',
    outline:      'none',
  },
  charCount: {
    position:   'absolute',
    right:      12,
    top:        '50%',
    transform:  'translateY(-50%)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   10,
    color:      'rgba(10,10,10,.38)',
  },

  error: {
    fontSize:     12.5,
    color:        '#DC2626',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    marginBottom: 10,
    fontWeight:   500,
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
    marginTop:     4,
  },

  // Added bar
  addedBar: {
    background:   '#F4F6FC',
    borderRadius: 14,
    padding:      '14px 16px',
    marginTop:    4,
  },
  addedText: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   14,
    fontWeight: 600,
    color:      '#065F46',
    marginBottom: 4,
  },
  addedSummary: {
    fontFamily:   "'JetBrains Mono', monospace",
    fontSize:     10.5,
    letterSpacing: '.3px',
    textTransform: 'uppercase',
    color:        'rgba(10,10,10,.45)',
    marginBottom: 12,
  },
  addedActions: { display: 'flex', gap: 8 },
  addedSecondary: {
    flex:         1,
    height:       44,
    borderRadius: 999,
    border:       '1px solid rgba(10,10,10,.12)',
    background:   '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    fontWeight:   600,
    cursor:       'pointer',
    color:        '#0A0A0A',
  },
  addedPrimary: {
    flex:         1,
    height:       44,
    borderRadius: 999,
    border:       'none',
    background:   '#1B36C9',
    color:        '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    fontWeight:   700,
    cursor:       'pointer',
  },
};
