/**
 * Maintenance page — shown when config/site.maintenanceMode === true.
 * Site Admins can still access /admin (bypassed in App.jsx).
 */
export default function Maintenance() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
      background: 'var(--color-bg)',
      color: 'var(--color-ink)',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <div style={{ marginBottom: '1.5rem', fontSize: 48 }}>🔧</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.05em', marginBottom: '0.75rem' }}>
        Tillfälligt stängt
      </h1>
      <p style={{ fontSize: '1rem', opacity: 0.65, maxWidth: 360, lineHeight: 1.6 }}>
        Butiken är för tillfället stängd för underhåll. Vi är snart tillbaka.
      </p>
      <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', opacity: 0.5 }}>
        Frågor? Kontakta oss på{' '}
        <a href="mailto:butik@nynashamnsgf.se" style={{ color: 'var(--color-royal)' }}>
          butik@nynashamnsgf.se
        </a>
      </p>
    </main>
  );
}
