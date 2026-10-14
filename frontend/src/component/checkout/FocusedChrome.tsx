import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import BeetleMark from '../brand/BeetleMark';

/**
 * Checkout replaces the shop's nav and footer with these, so paying has nothing else competing for attention.
 * The Cart is a drawer, not a page: "edit cart" returns to where the customer came from and opens it there.
 */
export const CheckoutHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { openCart } = useCart();

  const editCart = () => {
    // 'default' is the first entry of this visit: there is no earlier page in the shop to go back to.
    if (location.key !== 'default') navigate(-1);
    else navigate('/');
    openCart();
  };

  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-ink" aria-label="Silver Thief Bug">
          <BeetleMark className="h-7 w-7 shrink-0 text-accent-strong" />
          <span className="whitespace-nowrap font-display text-base font-bold sm:text-lg">Silver Thief Bug</span>
        </Link>
        <button
          type="button"
          onClick={editCart}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('checkout_page.edit_cart')}
        </button>
      </div>
    </header>
  );
};

export const CheckoutFooter: React.FC = () => {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-line bg-paper">
      <p className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-5 text-sm text-muted sm:px-6">
        <Link to="/contact" className="whitespace-nowrap underline-offset-4 hover:text-ink hover:underline">
          {t('checkout_page.contact_shop')}
        </Link>
        <span aria-hidden>·</span>
        <Link to="/shipping" className="whitespace-nowrap underline-offset-4 hover:text-ink hover:underline">
          {t('shipping_policy')}
        </Link>
      </p>
    </footer>
  );
};
