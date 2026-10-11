import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, User, Menu, X, LogOut, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BeetleMark from '../brand/BeetleMark';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { iconButton } from '../ui/buttonStyles';
import NotificationBell, { useNotifications } from './NotificationBell';

interface NavItem {
  to: string;
  key: string;
  end: boolean;
  /** Who sees the entry; everyone when absent. */
  only?: 'member' | 'admin';
}

/** The shop is the front page, so there is no separate "home" entry; the logo also leads there. */
const NAV: NavItem[] = [
  { to: '/', key: 'shop', end: true },
  { to: '/about', key: 'about', end: false },
  { to: '/contact', key: 'contact', end: false },
  { to: '/admin', key: 'nav.admin', end: false, only: 'admin' },
  { to: '/orders', key: 'nav.orders', end: false, only: 'member' },
];

/** Count badge on an icon button. Hidden from assistive tech: the button's label carries the number. */
const Badge: React.FC<{ n: number }> = ({ n }) =>
  n > 0 ? (
    <span
      aria-hidden
      className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-strong px-1 font-mono text-[10px] font-medium tabular-nums text-accent-ink"
    >
      {n > 9 ? '9+' : n}
    </span>
  ) : null;

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `relative whitespace-nowrap py-2 text-sm font-medium transition-colors motion-reduce:transition-none ${
    isActive
      ? 'text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent-strong'
      : 'text-muted hover:text-ink'
  }`;

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-[44px] items-center rounded-xl px-3 text-base font-medium ${isActive ? 'bg-sunken text-ink' : 'text-muted hover:text-ink'}`;

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const { totalItems, openCart } = useCart();
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isThai = (i18n.language || 'th').startsWith('th');
  const nav = NAV.filter((n) => !n.only || (n.only === 'admin' ? isAdmin : !!user));
  // One feed for both bells (desktop and phone header); only signed-in Members have one.
  const notifications = useNotifications(!!user);

  // A route change closes the mobile menu.
  useEffect(() => setIsOpen(false), [location.pathname]);

  const toggleLanguage = () => i18n.changeLanguage(isThai ? 'en' : 'th');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const cartLabel = totalItems > 0 ? t('nav.cart_count', { count: totalItems }) : t('cart');
  const favLabel = favorites.length > 0 ? t('nav.favorites_count', { count: favorites.length }) : t('favorites');
  const themeLabel = theme === 'dark' ? t('nav.light_mode') : t('nav.dark_mode');

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-ink" aria-label="Silver Thief Bug">
          <BeetleMark className="h-7 w-7 shrink-0 text-accent-strong" />
          <span className="whitespace-nowrap font-display text-lg font-bold">Silver Thief Bug</span>
        </Link>

        <nav aria-label={t('nav.main')} className="hidden items-center gap-7 lg:flex">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={desktopLink}>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-1 lg:flex">
          {/* Cart and Favorites belong to signed-in Customers (CONTEXT.md); guests are not offered them. */}
          {user && (
            <>
              <Link to="/favorites" className={`${iconButton} relative`} aria-label={favLabel} title={t('favorites')}>
                <Heart className="h-5 w-5" aria-hidden />
                <Badge n={favorites.length} />
              </Link>
              <button type="button" onClick={openCart} className={`${iconButton} relative`} aria-label={cartLabel} title={t('cart')}>
                <ShoppingBag className="h-5 w-5" aria-hidden />
                <Badge n={totalItems} />
              </button>
            </>
          )}
          {user && <NotificationBell state={notifications} />}
          <button type="button" onClick={toggleTheme} className={iconButton} aria-label={themeLabel} title={themeLabel}>
            {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={toggleLanguage}
            className={`${iconButton} font-mono text-xs font-medium`}
            aria-label={isThai ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
            title={t('language')}
          >
            {isThai ? 'EN' : 'TH'}
          </button>

          <span className="mx-2 h-6 w-px bg-line" aria-hidden />

          {user ? (
            <div className="flex items-center gap-1">
              <Link
                to="/account"
                className="max-w-[9rem] truncate rounded-lg px-2.5 py-2 text-sm font-medium text-ink hover:bg-sunken"
                title={t('nav.my_account')}
              >
                {user.full_name?.split(' ')[0] || t('nav.my_account')}
              </Link>
              <button type="button" onClick={handleLogout} className={`${iconButton} hover:text-danger`} aria-label={t('logout')} title={t('logout')}>
                <LogOut className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-line px-3.5 text-sm font-semibold text-ink transition-colors hover:border-muted"
            >
              <User className="h-4 w-4" aria-hidden />
              {t('login')}
            </Link>
          )}
        </div>

        {/* Phones: a signed-in Customer's cart stays one tap away; everything else is in the menu. */}
        <div className="flex items-center gap-1 lg:hidden">
          {user && <NotificationBell state={notifications} className="h-11 w-11" />}
          {user && (
            <button type="button" onClick={openCart} className={`${iconButton} relative h-11 w-11`} aria-label={cartLabel}>
              <ShoppingBag className="h-5 w-5" aria-hidden />
              <Badge n={totalItems} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            className={`${iconButton} h-11 w-11`}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? t('nav.close_menu') : t('nav.open_menu')}
          >
            {isOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div id="mobile-menu" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-paper lg:hidden">
          <nav aria-label={t('nav.main')} className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={mobileLink}>
                {t(n.key)}
              </NavLink>
            ))}
            {user && (
              <>
                <NavLink to="/favorites" className={mobileLink}>
                  {t('favorites')}
                  {favorites.length > 0 && <span className="ml-2 font-mono text-sm tabular-nums text-muted">{favorites.length}</span>}
                </NavLink>
                <NavLink to="/account" className={mobileLink}>
                  {t('nav.my_account')}
                </NavLink>
              </>
            )}
          </nav>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium text-ink"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
              {themeLabel}
            </button>
            <button type="button" onClick={toggleLanguage} className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-3 text-sm font-medium text-ink">
              {isThai ? 'English' : 'ภาษาไทย'}
            </button>
            <span className="flex-1" />
            {user ? (
              <button type="button" onClick={handleLogout} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted hover:text-danger">
                <LogOut className="h-4 w-4" aria-hidden />
                {t('logout')}
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent-strong px-4 text-sm font-semibold text-accent-ink"
              >
                <User className="h-4 w-4" aria-hidden />
                {t('login')}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
