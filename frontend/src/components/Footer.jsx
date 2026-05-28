import { Link } from 'react-router-dom';
import { useLangCtx } from '../context/LangContext';

export default function Footer() {
  const { t } = useLangCtx();

  return (
    <footer style={s.footer} role="contentinfo">
      <div style={s.inner}>

        {/* Line 1 — navigation links */}
        <nav style={s.nav} aria-label="Footer-navigering">
          <Link to="/om-oss"  style={s.link}>{t.nav.about}</Link>
          <span style={s.sep} aria-hidden="true">·</span>
          <Link to="/villkor" style={s.link}>{t.nav.tac}</Link>
          <span style={s.sep} aria-hidden="true">·</span>
          <Link to="/faq"     style={s.link}>{t.nav.faq}</Link>
        </nav>

        {/* Line 2 — email, centred */}
        <a href="mailto:butik@nynashamnsgf.se" style={s.email}>
          butik@nynashamnsgf.se
        </a>

      </div>
    </footer>
  );
}

const s = {
  footer: {
    background: '#0A0A0A',
    color:      '#fff',
  },
  inner: {
    maxWidth:  680,
    margin:    '0 auto',
    padding:   '26px 20px 22px',
    textAlign: 'center',
  },
  nav: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexWrap:       'wrap',
    gap:            10,
    marginBottom:   12,
  },
  link: {
    color:          'rgba(255,255,255,0.6)',
    fontSize:       14,
    fontWeight:     500,
    fontFamily:     "'Space Grotesk', system-ui, sans-serif",
    textDecoration: 'none',
  },
  sep: {
    color:    'rgba(255,255,255,0.2)',
    fontSize: 14,
  },
  email: {
    display:        'block',
    color:          'rgba(255,255,255,0.5)',
    fontSize:       13,
    fontFamily:     "'Space Grotesk', system-ui, sans-serif",
    textDecoration: 'none',
  },
};
