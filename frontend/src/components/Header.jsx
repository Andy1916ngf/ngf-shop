import { useState }                                      from 'react';
import { Link, useNavigate, useSearchParams }            from 'react-router-dom';
import { IconSearch, IconShoppingBag, IconX }            from '@tabler/icons-react';
import { useBasketCtx }                                  from '../context/BasketContext';
import { useLangCtx }                                    from '../context/LangContext';

// ── Logo ──────────────────────────────────────────────────────

function Logo() {
  return (
    <Link to="/" style={s.logo} aria-label="Nynäshamns GF Butik – startsida">
      {/* Full name on wider screens, NGF on very narrow — controlled by index.css */}
      <span className="logo-name-full" style={s.logoText}>Nynäshamns GF</span>
      <span className="logo-name-short" style={s.logoText}>NGF</span>
      <span style={s.logoDot} aria-hidden="true" />
      <span style={s.logoButik}>butik</span>
    </Link>
  );
}

// ── Circle icon button ─────────────────────────────────────────

function CircleBtn({ onClick, label, children, badge }) {
  return (
    <button onClick={onClick} aria-label={label} style={s.circleBtn}>
      {children}
      {badge > 0 && (
        <span style={s.badge} aria-label={`${badge} varor i varukorgen`}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ── Search overlay ─────────────────────────────────────────────

function SearchOverlay({ onClose, initialQuery }) {
  const [query, setQuery] = useState(initialQuery || '');
  const navigate          = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/?q=${encodeURIComponent(q)}`);
    onClose();
  }

  return (
    <div style={s.overlay}>
      <div style={s.overlayInner}>
        <form onSubmit={handleSubmit} style={s.searchForm}>
          <IconSearch size={17} color="rgba(10,10,10,0.45)" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Sök produkter…"
            style={s.searchInput}
            aria-label="Sökfält"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              style={s.clearBtn} aria-label="Rensa sökfält">
              <IconX size={15} />
            </button>
          )}
        </form>
        <button onClick={onClose} style={s.cancelBtn}>Avbryt</button>
      </div>
      {/* Dim overlay — clicking it closes search */}
      <div onClick={onClose} style={s.overlayDim} aria-hidden="true" />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────

export default function Header() {
  const { itemCount }        = useBasketCtx();
  const { lang, toggleLang } = useLangCtx();
  const [searchParams]       = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const currentQ = searchParams.get('q') || '';

  return (
    <>
      <header style={s.header}>
        <Logo />

        <div style={s.actions}>
          <CircleBtn onClick={() => setSearchOpen(true)} label="Öppna sökning">
            <IconSearch size={17} aria-hidden="true" />
          </CircleBtn>

          <Link to="/varukorg" style={{ textDecoration: 'none' }}>
            <CircleBtn label={`Varukorg, ${itemCount} varor`} badge={itemCount}>
              <IconShoppingBag size={17} aria-hidden="true" />
            </CircleBtn>
          </Link>

          <button
            onClick={toggleLang}
            style={s.langBtn}
            aria-label={lang === 'sv' ? 'Switch to English' : 'Byt till svenska'}>
            {lang === 'sv' ? 'EN' : 'SV'}
          </button>
        </div>
      </header>

      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          initialQuery={currentQ}
        />
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = {
  header: {
    position:       'sticky',
    top:            0,
    zIndex:         50,
    background:     '#fff',
    borderBottom:   '0.5px solid rgba(10,10,10,0.06)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '0 20px',
    height:         60,
  },

  logo: {
    display:        'flex',
    alignItems:     'center',
    textDecoration: 'none',
    color:          '#0A0A0A',
  },
  logoText: {
    fontFamily:  "'Space Grotesk', system-ui, sans-serif",
    fontWeight:  700,
  },
  logoDot: {
    display:      'inline-block',
    width:        5,
    height:       5,
    borderRadius: '50%',
    background:   '#1B36C9',
    margin:       '0 5px 1px',
    alignSelf:    'center',
    flexShrink:   0,
  },
  logoButik: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    500,
    fontSize:      11,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    opacity:       0.65,
    marginBottom:  1,
  },

  actions: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    flexShrink: 0,
  },

  circleBtn: {
    position:       'relative',
    width:          36,
    height:         36,
    borderRadius:   '50%',
    border:         'none',
    background:     'rgba(10,10,10,0.06)',
    color:          '#0A0A0A',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    cursor:         'pointer',
    flexShrink:     0,
  },

  badge: {
    position:       'absolute',
    top:            -2,
    right:          -3,
    minWidth:       17,
    height:         17,
    borderRadius:   999,
    background:     '#1B36C9',
    color:          '#fff',
    fontSize:       10,
    fontWeight:     700,
    fontFamily:     "'Space Grotesk', system-ui, sans-serif",
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '0 3px',
    pointerEvents:  'none',
  },

  langBtn: {
    height:        32,
    padding:       '0 10px',
    borderRadius:  999,
    border:        '0.5px solid rgba(10,10,10,0.08)',
    background:    'transparent',
    color:         '#2A2A2E',
    fontSize:      11,
    fontWeight:    600,
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    letterSpacing: '0.6px',
    cursor:        'pointer',
  },

  // Search overlay
  overlay: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    zIndex:   99,
  },
  overlayInner: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    padding:    '10px 16px',
    background: 'rgba(10,10,10,0.55)',
    position:   'relative',
    zIndex:     100,
  },
  searchForm: {
    flex:        1,
    display:     'flex',
    alignItems:  'center',
    gap:         10,
    background:  '#fff',
    borderRadius: 12,
    padding:     '0 14px',
    height:      46,
  },
  searchInput: {
    flex:       1,
    border:     'none',
    outline:    'none',
    background: 'transparent',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   15,
    color:      '#0A0A0A',
  },
  clearBtn: {
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    color:      'rgba(10,10,10,0.45)',
    display:    'flex',
    padding:    0,
  },
  cancelBtn: {
    background:  'none',
    border:      'none',
    color:       '#fff',
    fontFamily:  "'Space Grotesk', system-ui, sans-serif",
    fontSize:    14,
    fontWeight:  500,
    cursor:      'pointer',
    flexShrink:  0,
    padding:     '0 4px',
  },
  overlayDim: {
    height:     200,
    background: 'rgba(10,10,10,0.45)',
  },
};
