import { useEffect, useState } from 'react';
import { doc, getDoc }         from 'firebase/firestore';
import { db }                  from '../firebase';
import RichText                from '../components/RichText';

/**
 * Fetches and renders a static page from Firestore.
 * Firestore path: content/{pageId} → { title: string, body: string (HTML) }
 *
 * pageId is one of: 'about' | 'tac' | 'faq'
 * Routes: /om-oss → about, /villkor → tac, /faq → faq
 */
export default function StaticPage({ pageId }) {
  const [page,    setPage]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDoc(doc(db, 'content', pageId))
      .then(snap => { if (snap.exists()) setPage(snap.data()); })
      .finally(() => setLoading(false));
  }, [pageId]);

  if (loading) return <main style={s.page}><p style={s.muted}>Laddar…</p></main>;
  if (!page)   return <main style={s.page}><p style={s.muted}>Sidan hittades inte.</p></main>;

  return (
    <main style={s.page}>
      <h1 style={s.title}>{page.title}</h1>
      <RichText html={page.body} />
    </main>
  );
}

const s = {
  page: {
    maxWidth:  660,
    margin:    '0 auto',
    padding:   '32px 20px 56px',
  },
  title: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      'clamp(22px, 6vw, 30px)',
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
    marginBottom:  24,
  },
  muted: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    color:      'rgba(10,10,10,.4)',
    fontSize:   14,
  },
};
