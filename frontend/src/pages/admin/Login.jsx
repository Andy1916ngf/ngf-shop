import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import { signInWithPopup, signOut,
         GoogleAuthProvider,
         getIdTokenResult }    from 'firebase/auth';
import { httpsCallable }       from 'firebase/functions';
import { auth, funcs }         from '../../firebase';
import { useAuth }             from '../../hooks/useAuth';

const getRoleFn = httpsCallable(funcs, 'getRole');

export default function Login() {
  const { user, role, loading } = useAuth();
  const navigate                = useNavigate();
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  // Already logged in with a valid role — go straight to orders
  useEffect(() => {
    if (!loading && user && role) navigate('/admin/ordrar', { replace: true });
  }, [user, role, loading]);

  async function handleLogin() {
    setError('');
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      // Hint the domain so Google pre-fills the org account
      provider.setCustomParameters({ hd: 'nynashamnsgf.se' });

      const result = await signInWithPopup(auth, provider);

      // Enforce domain restriction — only @nynashamnsgf.se accounts allowed
      if (!result.user.email.endsWith('@nynashamnsgf.se')) {
        await signOut(auth);
        setError('Kontot måste vara ett @nynashamnsgf.se-konto.');
        return;
      }

      // Trigger role assignment — checks config/adminRoles in Firestore
      await getRoleFn();

      // Force token refresh to pick up the new ngfRole claim
      const token = await getIdTokenResult(result.user, true);
      if (!token.claims.ngfRole) {
        await signOut(auth);
        setError('Du saknar behörighet. Kontakta en systemadministratör.');
        return;
      }

      navigate('/admin/ordrar', { replace: true });
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Inloggning misslyckades. Försök igen.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <main style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>
          <p style={s.brandName}>NGF</p>
          <p style={s.brandSub}>Admin</p>
        </div>

        <p style={s.instruction}>
          Logga in med ditt @nynashamnsgf.se-konto.
        </p>

        {error && <p style={s.error} role="alert">{error}</p>}

        <button onClick={handleLogin} disabled={busy} style={s.btn}>
          <svg style={s.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
            <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/>
            <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
            <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
          </svg>
          {busy ? 'Loggar in…' : 'Logga in med Google'}
        </button>
      </div>
    </main>
  );
}

const s = {
  page: {
    minHeight:       '100vh',
    background:      '#F4F6FC',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  card: {
    background:   '#fff',
    borderRadius: 20,
    padding:      '36px 32px',
    width:        '100%',
    maxWidth:     360,
    border:       '0.5px solid rgba(10,10,10,.07)',
    textAlign:    'center',
  },
  brand: { marginBottom: 24 },
  brandName: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      32,
    letterSpacing: '-0.05em',
    color:         '#1B36C9',
    lineHeight:    1,
  },
  brandSub: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      11,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.4)',
    marginTop:     4,
  },
  instruction: {
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13.5,
    color:        'rgba(10,10,10,.52)',
    marginBottom: 20,
    lineHeight:   1.5,
  },
  error: {
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    color:        '#DC2626',
    fontWeight:   500,
    marginBottom: 14,
    background:   '#FEF2F2',
    borderRadius: 8,
    padding:      '9px 12px',
  },
  btn: {
    width:         '100%',
    height:        48,
    borderRadius:  12,
    border:        '0.5px solid rgba(10,10,10,.12)',
    background:    '#fff',
    display:       'flex',
    alignItems:    'center',
    justifyContent: 'center',
    gap:           10,
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      14,
    fontWeight:    600,
    color:         '#0A0A0A',
    cursor:        'pointer',
  },
  googleIcon: { width: 18, height: 18, flexShrink: 0 },
};