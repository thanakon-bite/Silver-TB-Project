import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Swal from 'sweetalert2';
import i18n from './i18n';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './component/common/NotificationToast';
import { RequireAuth, RequireAdmin } from './component/auth/RouteGuards';
import Navbar from './component/layout/Navbar';
import Footer from './component/layout/Footer';
import Cart from './pages/Cart';
import Products from './pages/Products';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Account from './pages/Account';
import AdminDashboard from './pages/AdminDashboard';
import Favorites from './pages/Favorites';
import About from './pages/About';
import Contact from './pages/Contact';
import ShippingPolicy from './pages/ShippingPolicy';
import Faq from './pages/Faq';
import LegalPage from './pages/LegalPage';
import { PUBLISHED } from './component/content/published';

// Redirect logged-in users away from login page
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
};

/** The shop moved to the front page; old /products links (and their filters) still land on it. */
const ShopRedirect: React.FC = () => <Navigate to={{ pathname: '/', search: useLocation().search }} replace />;

/** Checkout renders its own <main> between its focused header and footer, so it must not be nested in ours. */
const Main: React.FC<{ focused: boolean; children: React.ReactNode }> = ({ focused, children }) =>
  focused ? <>{children}</> : <main className="flex-grow">{children}</main>;

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
        Swal.fire({
          icon: 'info',
          title: i18n.t('session_expired.title'),
          text: i18n.t('session_expired.text'),
        }).then(() => {
          navigate('/login');
        });
      }, 15 * 60 * 1000); // 15 minutes
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [user, logout, navigate]);

  // A new page starts at its top (footer links otherwise land mid-page); a #hash scrolls to that section.
  React.useEffect(() => {
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target) target.scrollIntoView?.();
    else document.documentElement.scrollTop = 0;
  }, [location.pathname, location.hash]);

  // Checkout brings its own focused header and footer (see FocusedChrome).
  const focused = location.pathname === '/checkout';

  return (
    // Framer animations (step slides, the Cart drawer) follow the system's reduced-motion setting.
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col bg-paper font-sans text-ink">
        {!focused && <Navbar />}
        <Main focused={focused}>
          <Routes>
            <Route path="/" element={<Products />} />
            <Route path="/products" element={<ShopRedirect />} />
            <Route path="/favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
            <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
            <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
            <Route path="/shipping" element={<ShippingPolicy />} />
            {/* Drafts until the seller is named (component/content/published); the catch-all sends visitors home. */}
            {PUBLISHED.terms && <Route path="/terms" element={<LegalPage doc="terms" />} />}
            {PUBLISHED.privacy && <Route path="/privacy" element={<LegalPage doc="privacy" />} />}
            <Route path="/faq" element={<Faq />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Main>
        {!focused && <Footer />}
        {/* Cart slide-over renders on top of everything */}
        <Cart />
      </div>
    </MotionConfig>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <ThemeProvider>
            <ToastProvider>
            <React.Suspense fallback={<div className="min-h-screen bg-paper" />}>
              <AppShell />
            </React.Suspense>
            </ToastProvider>
          </ThemeProvider>
        </FavoritesProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
