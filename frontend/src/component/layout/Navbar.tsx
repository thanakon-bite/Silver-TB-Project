import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, User, Menu, X, Bug, LogOut, Package, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const { totalItems, openCart } = useCart();
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const toggleLanguage = () => {
    const currentLang = i18n.language || i18n.options.lng || 'th';
    const newLang = currentLang.startsWith('th') ? 'en' : 'th';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      icon: 'question',
      title: t('logout') + '?',
      showCancelButton: true,
      confirmButtonColor: '#FF922B',
      confirmButtonText: t('logout'),
    });
    if (result.isConfirmed) {
      await logout();
      navigate('/');
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
              <Bug className="w-8 h-8 text-orange group-hover:rotate-12 transition-transform" />
              <span className="text-2xl font-bold tracking-tight">
                <span className="text-silver-dark italic">Silver</span>
                <span className="text-orange">Thief</span>
                <span className="text-gray-900 dark:text-gray-100">Bug</span>
              </span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 dark:text-gray-300 hover:text-orange font-medium transition-colors">{t('home')}</Link>
            <Link to="/products" className="text-gray-700 dark:text-gray-300 hover:text-orange font-medium transition-colors">{t('shop')}</Link>
            <Link to="/about" className="text-gray-700 dark:text-gray-300 hover:text-orange font-medium transition-colors">{t('about')}</Link>
            <Link to="/contact" className="text-gray-700 dark:text-gray-300 hover:text-orange font-medium transition-colors">{t('contact')}</Link>
          </div>

          <div className="hidden md:flex items-center space-x-5">
            {/* Favorites */}
            <Link to="/favorites" className="p-2 text-gray-500 dark:text-gray-400 hover:text-orange transition-colors relative">
              <Heart className="w-6 h-6" />
              {favorites.length > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {favorites.length > 9 ? '9+' : favorites.length}
                </span>
              )}
            </Link>

            {/* Cart */}
            <button onClick={openCart} className="p-2 text-gray-500 dark:text-gray-400 hover:text-orange transition-colors relative">
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 bg-orange text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-orange transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-orange hover:border-orange transition-colors uppercase"
              title={t('language')}
            >
              {i18n.language?.startsWith('th') ? 'TH' : 'EN'}
            </button>

            {/* User */}
            {user ? (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Link to="/admin" className="text-xs font-bold bg-orange/10 text-orange px-2 py-1 rounded-md uppercase tracking-wider mr-2 hover:bg-orange/20 transition-colors">Admin</Link>
                )}
                <Link to="/orders" title="My orders" className="p-2 text-gray-500 dark:text-gray-400 hover:text-orange transition-colors">
                  <Package className="w-5 h-5" />
                </Link>
                <Link to="/account" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange">{user.full_name?.split(' ')[0]}</Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full border-2 border-gray-200 dark:border-gray-700 hover:border-red-300 hover:text-red-500 transition-all text-sm font-semibold text-gray-500 dark:text-gray-400"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-silver dark:border-gray-600 hover:bg-silver-light transition-all"
              >
                <User className="w-5 h-5" />
                <span className="text-sm font-semibold">{t('login')}</span>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button onClick={openCart} className="p-2 text-gray-500 dark:text-gray-400 hover:text-orange relative">
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 bg-orange text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-orange hover:bg-gray-100 focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <div className="flex justify-between px-3 py-2">
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-500 hover:text-orange dark:text-gray-400"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={toggleLanguage}
                className="px-3 py-1 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {i18n.language?.startsWith('th') ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
              </button>
            </div>
            <Link to="/" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-orange font-medium">{t('home')}</Link>
            <Link to="/products" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-orange font-medium">{t('shop')}</Link>
            <Link to="/favorites" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-orange font-medium">
              {t('favorites')} {favorites.length > 0 && <span className="ml-1 text-red-500 font-bold">({favorites.length})</span>}
            </Link>
            {isAdmin && (
              <Link to="/admin" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-orange font-bold">{t('adminDashboard')}</Link>
            )}
            {user && (
              <>
                <Link to="/orders" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-gray-700 hover:text-orange font-medium">My orders</Link>
                <Link to="/account" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-gray-700 hover:text-orange font-medium">My account</Link>
              </>
            )}
            {user ? (
              <button onClick={() => { setIsOpen(false); handleLogout(); }} className="block w-full text-left px-3 py-2 text-red-500 font-medium">
                {t('logout')}
              </button>
            ) : (
              <Link to="/login" onClick={() => setIsOpen(false)} className="block px-3 py-2 bg-orange text-white rounded-md mt-4 text-center font-bold">{t('login')}</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
