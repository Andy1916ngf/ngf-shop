import { useEffect, useState }                          from 'react';
import { BrowserRouter, Routes, Route,
         Navigate, Outlet }                            from 'react-router-dom';
import { doc, onSnapshot }                             from 'firebase/firestore';
import { db }                                          from './firebase';
import { useAuth }                                     from './hooks/useAuth';

// Layout components
import Header        from './components/Header';
import Footer        from './components/Footer';
import Maintenance   from './pages/Maintenance';

// Public shop pages
import Catalog       from './pages/shop/Catalog';
import Product       from './pages/shop/Product';
import Basket        from './pages/shop/Basket';
import Checkout      from './pages/shop/Checkout';
import Confirmation  from './pages/Confirmation';
import StaticPage    from './pages/StaticPage';

// Admin pages
import AdminLayout   from './pages/admin/AdminLayout';
import Login         from './pages/admin/Login';
import Orders        from './pages/admin/Orders';
import OrderDetail   from './pages/admin/OrderDetail';
import Products      from './pages/admin/Products';
import ProductEdit   from './pages/admin/ProductEdit';
import Settings      from './pages/admin/Settings';

// ── PublicLayout ──────────────────────────────────────────────
// Wraps all customer-facing pages with Header + Footer.
// Watches config/site.maintenanceMode via onSnapshot — if the
// admin toggles it on, the maintenance page appears immediately
// for all customers without a page refresh.

function PublicLayout() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [ready,           setReady]           = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'site'),
      snap  => { setMaintenanceMode(snap.data()?.maintenanceMode === true); setReady(true); },
      _err  => { setReady(true); }   // offline / rules error — default to open
    );
    return unsub;
  }, []);

  // Hold render until we know whether maintenance mode is active
  if (!ready) return <div style={{ minHeight: '100vh' }} />;

  if (maintenanceMode) return <Maintenance />;

  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}

// ── SiteAdminGuard ────────────────────────────────────────────
// Protects routes that only siteAdmin users may access
// (currently only Inställningar).

function SiteAdminGuard() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== 'siteAdmin') return <Navigate to="/admin/ordrar" replace />;
  return <Outlet />;
}

// ── App ───────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Admin — always accessible, manages its own auth ── */}
        <Route path="/admin/login" element={<Login />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index                element={<Navigate to="ordrar" replace />} />

          {/* Both shopAdmin and siteAdmin */}
          <Route path="ordrar"        element={<Orders />} />
          <Route path="ordrar/:id"    element={<OrderDetail />} />
          <Route path="produkter"     element={<Products />} />
          <Route path="produkter/ny"  element={<ProductEdit isNew />} />
          <Route path="produkter/:id" element={<ProductEdit />} />

          {/* siteAdmin only */}
          <Route element={<SiteAdminGuard />}>
            <Route path="installningar" element={<Settings />} />
          </Route>
        </Route>

        {/* ── Checkout — its own minimal shell ─────────────── */}
        {/* Checkout.jsx renders its own top bar, no Header/Footer */}
        <Route path="/checkout" element={<Checkout />} />

        {/* ── Public shop — Header + Footer + maintenance check */}
        <Route element={<PublicLayout />}>
          <Route path="/"             element={<Catalog />} />
          <Route path="/produkt/:id"  element={<Product />} />
          <Route path="/varukorg"     element={<Basket />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/om-oss"       element={<StaticPage pageId="about" />} />
          <Route path="/villkor"      element={<StaticPage pageId="tac"   />} />
          <Route path="/faq"          element={<StaticPage pageId="faq"   />} />
          {/* Catch-all → home */}
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}
