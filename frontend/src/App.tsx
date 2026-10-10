import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './component/common/NotificationToast';
import { RequireAuth, RequireAdmin } from './component/auth/RouteGuards';
import Navbar from './component/layout/Navbar';
import Footer from './component/layout/Footer';
import Cart from './pages/Cart';
import Home from './pages/Home';
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

const Placeholder = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <h1 className="text-3xl font-bold text-gray-500 dark:text-gray-400">{title}</h1>
  </div>
);

// Redirect logged-in users away from login page
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
};

function AppShell() {
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
          title: 'Session Expired',
          text: 'You have been logged out due to 15 minutes of inactivity.',
          confirmButtonColor: '#FF922B'
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

  // Checkout brings its own focused header and footer (see FocusedChrome).
  const focused = location.pathname === '/checkout';

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-800 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      {!focused && <Navbar />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Placeholder title="Contact Us" />} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/shipping" element={<Placeholder title="Shipping Policy" />} />
          <Route path="/terms" element={<Placeholder title="Terms of Service" />} />
          <Route path="/privacy" element={<Placeholder title="Privacy Policy" />} />
          <Route path="/faq" element={<Placeholder title="FAQs" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!focused && <Footer />}
      {/* Cart slide-over renders on top of everything */}
      <Cart />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <ThemeProvider>
            <ToastProvider>
            <React.Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
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
