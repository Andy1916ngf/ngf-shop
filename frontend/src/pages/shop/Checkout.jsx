import { useEffect, useRef }  from 'react';
import { useLocation,
         useNavigate }        from 'react-router-dom';

/**
 * Checkout page — renders the Kustom Checkout widget.
 *
 * Flow:
 *   1. Basket calls createOrder → receives html_snippet
 *   2. Basket navigates here with html_snippet in router state
 *   3. This page injects the snippet into the DOM
 *   4. Kustom's scripts mount the payment iframe into #kco-checkout
 *   5. Customer pays → Kustom redirects to /confirmation?order_id=…
 *
 * Kustom requires innerHTML (not dangerouslySetInnerHTML) so that the
 * embedded <script> tags actually execute. A re-execution pass handles
 * scripts that browsers skip when set via innerHTML.
 */
export default function Checkout() {
  const location     = useLocation();
  const navigate     = useNavigate();
  const containerRef = useRef(null);
  const htmlSnippet  = location.state?.html_snippet;

  useEffect(() => {
    if (!htmlSnippet || !containerRef.current) return;

    containerRef.current.innerHTML = htmlSnippet;

    // Re-execute scripts — browsers skip scripts injected via innerHTML
    Array.from(containerRef.current.querySelectorAll('script')).forEach(old => {
      const fresh = document.createElement('script');
      Array.from(old.attributes).forEach(a => fresh.setAttribute(a.name, a.value));
      fresh.textContent = old.textContent;
      old.parentNode.replaceChild(fresh, old);
    });
  }, [htmlSnippet]);

  // Invalid session — user navigated here directly or state was lost
  if (!htmlSnippet) {
    return (
      <main style={s.errorPage}>
        <p style={s.errorText}>Checkout-sessionen är ogiltig eller har gått ut.</p>
        <button onClick={() => navigate('/varukorg')} style={s.errorBtn}>
          ← Tillbaka till varukorgen
        </button>
      </main>
    );
  }

  return (
    <main style={s.page}>

      {/* Minimal header — no basket icon during checkout */}
      <div style={s.topBar}>
        <button onClick={() => navigate('/varukorg')} style={s.backLink}>
          ← Varukorg
        </button>
        <span style={s.secBadge}>🔒 Säker betalning</span>
      </div>

      {/* Kustom mounts its iframe into this div */}
      <div ref={containerRef} id="kco-checkout" style={s.kcoWrap} />

    </main>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#fff',
  },
  topBar: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '14px 20px',
    borderBottom:   '0.5px solid rgba(10,10,10,.07)',
  },
  backLink: {
    background:     'none',
    border:         'none',
    fontFamily:     "'Space Grotesk', system-ui, sans-serif",
    fontSize:       13,
    fontWeight:     500,
    color:          'rgba(10,10,10,.55)',
    cursor:         'pointer',
    padding:        0,
  },
  secBadge: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    letterSpacing: '.5px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.4)',
  },
  kcoWrap: {
    width:    '100%',
    minHeight: '60vh',
  },

  // Error state
  errorPage: {
    minHeight:      '60vh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '40px 20px',
    gap:            20,
  },
  errorText: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   15,
    color:      'rgba(10,10,10,.5)',
    textAlign:  'center',
  },
  errorBtn: {
    padding:      '12px 24px',
    borderRadius: 999,
    border:       '1px solid rgba(10,10,10,.12)',
    background:   '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     14,
    fontWeight:   600,
    cursor:       'pointer',
    color:        '#0A0A0A',
  },
};
