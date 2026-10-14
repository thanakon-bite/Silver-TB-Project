import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import BeetleMark from '../brand/BeetleMark';
import { SHOP_EMAIL, SHOP_MAP_URL, SHOP_PHONE, SHOP_TEL, SOCIAL_LINKS } from '../brand/social';
import { PUBLISHED } from '../content/published';
import { useAuth } from '../../contexts/AuthContext';

const linkClass = 'text-muted underline-offset-4 transition-colors hover:text-ink hover:underline motion-reduce:transition-none';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <footer className="border-t border-line bg-sunken">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-ink">
              <BeetleMark className="h-7 w-7 text-accent-strong" />
              <span className="font-display text-lg font-bold">Silver Thief Bug</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{t('footer_desc')}</p>
            <ul className="mt-5 flex gap-1">
              {SOCIAL_LINKS.map(({ label, url, Icon }) => (
                <li key={label}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-paper hover:text-ink motion-reduce:transition-none"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-labelledby="footer-shop">
            <h2 id="footer-shop" className="text-sm font-semibold text-ink">
              {t('quick_links')}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link to="/" className={linkClass}>{t('shop_all_beetle')}</Link></li>
              <li><Link to="/about" className={linkClass}>{t('about')}</Link></li>
              {/* Favorites are for Members; signing up is for guests. */}
              {user ? (
                <li><Link to="/favorites" className={linkClass}>{t('favorites')}</Link></li>
              ) : (
                <li><Link to="/login?mode=signup" className={linkClass}>{t('membership')}</Link></li>
              )}
            </ul>
          </nav>

          <nav aria-labelledby="footer-help">
            <h2 id="footer-help" className="text-sm font-semibold text-ink">
              {t('support')}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link to="/contact" className={linkClass}>{t('contact_us')}</Link></li>
              <li><Link to="/shipping" className={linkClass}>{t('shipping_policy')}</Link></li>
              {PUBLISHED.terms && <li><Link to="/terms" className={linkClass}>{t('terms_of_service')}</Link></li>}
              {PUBLISHED.privacy && <li><Link to="/privacy" className={linkClass}>{t('privacy_policy')}</Link></li>}
              <li><Link to="/faq" className={linkClass}>{t('faq')}</Link></li>
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('contact_us')}</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <a href={SHOP_MAP_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {t('address_full')}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <a href={SHOP_TEL} className={`${linkClass} font-mono tabular-nums`}>
                  {SHOP_PHONE}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <a href={`mailto:${SHOP_EMAIL}`} className={`${linkClass} break-all`}>
                  {SHOP_EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-line pt-6 text-xs text-muted">
          © {new Date().getFullYear()} {t('all_rights_reserved')}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
