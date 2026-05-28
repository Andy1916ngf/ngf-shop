import { useEffect, useState }                   from 'react';
import { Outlet, NavLink, useNavigate }          from 'react-router-dom';
import { signOut }                               from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { IconLayoutList, IconBox,
         IconSettings2, IconLogout }             from '@tabler/icons-react';
import { auth, db }                              from '../../firebase';
import { useAuth }                               from '../../hooks/useAuth';

export default function AdminLayout() {
  const { user, role, loading } = useAuth();
  const navigate                = useNavigate();
  const [newOrders, setNewOrders] = useState(0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) navigate('/admin/login', { replace: true });
  }, [user, loading]);

  // Real-time count of unconfirmed orders for the badge
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'orders'), where('status', '==', 'beställd'));
    return onSnapshot(q, snap => setNewOrders(snap.size));
  }, [user]);

  async function handleLogout() {
    await signOut(auth);
    navigate('/admin/login', { replace: true });
  }

  if (loading) return <div style={s.splash}>…</div>;
  if (!user)   return null;

  const isSiteAdmin = role === 'siteAdmin';

  const links = [
    { to: '/admin/ordrar',          label: 'Ordrar',         Icon: IconLayoutList, badge: newOrders },
    { to: '/admin/produkter',       label: 'Produkter',      Icon: IconBox },
    ...(isSiteAdmin ? [
      { to: '/admin/installningar', label: 'Inställningar',  Icon: IconSettings2 },
    ] : []),
  ];

  return (
    <div style={s.shell}>

      {/* ── Sidebar — desktop ──────────────────────────── */}
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <p style={s.brandName}>NGF</p>
          <p style={s.brandSub}>Admin</p>
        </div>

        <nav style={s.nav}>
          {links.map(({ to, label, Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                ...s.link,
                ...(isActive ? s.linkActive : s.linkIdle),
              })}>
              <Icon size={16} />
              <span style={s.linkLabel}>{label}</span>
              {badge > 0 && <span style={s.badge}>{badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={s.sidebarFoot}>
          <p style={s.userEmail}>{user.email}</p>
          <button onClick={handleLogout} style={s.logoutBtn}>
            <IconLogout size={13} /> Logga ut
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────── */}
      <div style={s.content}>
        <Outlet />
      </div>

      {/* ── Bottom nav — mobile ────────────────────────── */}
      <nav style={s.bottomNav}>
        {links.map(({ to, label, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              ...s.bottomItem,
              ...(isActive ? s.bottomItemActive : {}),
            })}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={22} />
              {badge > 0 && <span style={s.bottomBadge}>{badge}</span>}
            </div>
            <span style={s.bottomLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  );
}

const s = {
  splash: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  shell: {
    display:   'flex',
    minHeight: '100vh',
    background: '#F4F6FC',
  },

  // Sidebar
  sidebar: {
    width:          220,
    background:     '#fff',
    borderRight:    '0.5px solid rgba(10,10,10,.08)',
    display:        'flex',
    flexDirection:  'column',
    flexShrink:     0,
    position:       'sticky',
    top:            0,
    height:         '100vh',
    // hide on mobile via @media — handled in index.css
  },
  brand: {
    padding:       '24px 20px 18px',
    borderBottom:  '0.5px solid rgba(10,10,10,.06)',
  },
  brandName: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      20,
    letterSpacing: '-0.04em',
    color:         '#1B36C9',
    lineHeight:    1,
  },
  brandSub: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.4)',
    marginTop:     3,
  },
  nav: {
    flex:    1,
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap:     3,
  },
  link: {
    display:       'flex',
    alignItems:    'center',
    gap:           9,
    padding:       '9px 12px',
    borderRadius:  10,
    textDecoration: 'none',
    fontSize:      13.5,
    fontWeight:    500,
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    transition:    'background 0.12s',
  },
  linkIdle: {
    color:      'rgba(10,10,10,.6)',
    background: 'transparent',
  },
  linkActive: {
    color:      '#0A0A0A',
    background: '#F4F6FC',
    fontWeight: 600,
  },
  linkLabel: { flex: 1 },
  badge: {
    minWidth:       18,
    height:         18,
    borderRadius:   999,
    background:     '#1B36C9',
    color:          '#fff',
    fontSize:       10,
    fontWeight:     700,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '0 4px',
    fontFamily:     "'JetBrains Mono', monospace",
  },
  sidebarFoot: {
    padding:      '14px 18px',
    borderTop:    '0.5px solid rgba(10,10,10,.06)',
  },
  userEmail: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   10,
    letterSpacing: '.2px',
    color:      'rgba(10,10,10,.4)',
    marginBottom: 8,
    overflow:   'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    background: 'none',
    border:     'none',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   12.5,
    fontWeight: 500,
    color:      'rgba(10,10,10,.45)',
    cursor:     'pointer',
    padding:    0,
  },

  // Main
  content: {
    flex:    1,
    padding: '28px 24px 80px', // bottom padding for mobile nav
    minWidth: 0,
  },

  // Bottom nav (mobile — visibility toggled via .admin-sidebar / .admin-bottom-nav in index.css)
  bottomNav: {
    display:        'none',  // shown via index.css media query
    position:       'fixed',
    bottom:         0,
    left:           0,
    right:          0,
    height:         60,
    background:     '#fff',
    borderTop:      '0.5px solid rgba(10,10,10,.08)',
    zIndex:         50,
    justifyContent: 'space-around',
    alignItems:     'center',
  },
  bottomItem: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           3,
    flex:          1,
    textDecoration: 'none',
    color:         'rgba(10,10,10,.45)',
    padding:       '6px 0',
  },
  bottomItemActive: {
    color: '#1B36C9',
  },
  bottomLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   10,
    fontWeight: 600,
    letterSpacing: '.4px',
  },
  bottomBadge: {
    position:   'absolute',
    top:        -4,
    right:      -6,
    minWidth:   14,
    height:     14,
    borderRadius: 999,
    background: '#1B36C9',
    color:      '#fff',
    fontSize:   9,
    fontWeight: 700,
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding:    '0 3px',
  },
};
