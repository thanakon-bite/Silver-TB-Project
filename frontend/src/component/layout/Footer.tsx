import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const TiktokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.23-1.15 4.39-2.9 5.85-1.78 1.48-4.22 2.1-6.49 1.64-2.26-.45-4.28-1.92-5.46-3.95-1.19-2.04-1.39-4.59-.51-6.79.88-2.2 2.7-3.95 4.95-4.7 2.27-.75 4.8-.57 6.88.6v4.22c-1.02-.62-2.27-.85-3.41-.6-1.13.25-2.12.98-2.68 1.98-.56 1-.68 2.22-.32 3.3.36 1.08 1.18 1.95 2.22 2.36 1.05.41 2.26.35 3.26-.16 1-.51 1.71-1.43 1.98-2.52.12-.47.16-.96.15-1.45V.02h-4.32z" />
  </svg>
);

const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Logo and Description */}
          <div className="col-span-1 md:col-span-1 border-b border-gray-800 pb-8 md:border-0 md:pb-0">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <span className="text-2xl font-bold tracking-tight">
                <span className="text-silver italic">Silver</span>
                <span className="text-orange">Thief</span>
                <span className="text-white font-normal uppercase text-xs tracking-widest ml-1">Bug</span>
              </span>
            </Link>
            <p className="text-gray-400 dark:text-gray-500 text-sm leading-relaxed mb-6">
              {t('footer_desc')}
            </p>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/profile.php?id=61570775870548&locale=th_TH" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 rounded-full hover:bg-orange transition-colors duration-300">
                <FacebookIcon className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/silverthiefbug.official/?utm_source=ig_web_button_share_sheet" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 rounded-full hover:bg-orange transition-colors duration-300">
                <InstagramIcon className="w-5 h-5" />
              </a>
              <a href="https://www.tiktok.com/@silver.thief.bug" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 rounded-full hover:bg-orange transition-colors duration-300">
                <TiktokIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-span-1">
            <h3 className="text-lg font-bold mb-6 text-white border-l-4 border-orange pl-3 uppercase tracking-wider text-sm">{t('quick_links')}</h3>
            <ul className="space-y-4 text-gray-400 dark:text-gray-500 text-sm font-medium">
              <li><Link to="/products" className="hover:text-orange transition-colors">{t('shop_all_beetle')}</Link></li>
              <li><Link to="/about" className="hover:text-orange transition-colors">{t('our_story')}</Link></li>
              <li><Link to="/favorites" className="hover:text-orange transition-colors">{t('favorites')}</Link></li>
              <li><Link to="/login" className="hover:text-orange transition-colors">{t('membership')}</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="col-span-1">
            <h3 className="text-lg font-bold mb-6 text-white border-l-4 border-orange pl-3 uppercase tracking-wider text-sm">{t('support')}</h3>
            <ul className="space-y-4 text-gray-400 dark:text-gray-500 text-sm font-medium">
              <li><Link to="/shipping" className="hover:text-orange transition-colors">{t('shipping_policy')}</Link></li>
              <li><Link to="/terms" className="hover:text-orange transition-colors">{t('terms_of_service')}</Link></li>
              <li><Link to="/privacy" className="hover:text-orange transition-colors">{t('privacy_policy')}</Link></li>
              <li><Link to="/faq" className="hover:text-orange transition-colors">{t('faq')}</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="col-span-1">
            <h3 className="text-lg font-bold mb-6 text-white border-l-4 border-orange pl-3 uppercase tracking-wider text-sm">{t('contact_us')}</h3>
            <ul className="space-y-4 text-gray-400 dark:text-gray-500 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-orange flex-shrink-0" />
                <a href="https://www.google.com/maps/place/1+%E0%B8%95%E0%B8%B3%E0%B8%9A%E0%B8%A5+%E0%B8%A5%E0%B8%B3%E0%B8%99%E0%B8%B2%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%93%E0%B9%8C+%E0%B8%AD%E0%B8%B3%E0%B9%80%E0%B8%A0%E0%B8%AD%E0%B8%8A%E0%B8%B1%E0%B8%A2%E0%B8%9A%E0%B8%B2%E0%B8%94%E0%B8%B2%E0%B8%A5+%E0%B8%A5%E0%B8%9E%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5+15130/@15.2084415,101.1476859,475m/data=!3m1!1e3!4m6!3m5!1s0x311e4345489d9b99:0x5ca6db51f6e6a2f3!8m2!3d15.2094508!4d101.1492295!16s%2Fg%2F11thqhfmxz?entry=ttu&g_ep=EgoyMDI2MDUxMS4wIKXMDSoASAFQAw%3D%3D" target="_blank" rel="noopener noreferrer" className="hover:text-orange transition-colors">
                  {t('address_123')}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-orange flex-shrink-0" />
                <span>095 681 2084</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-orange flex-shrink-0" />
                <span>silverthiefbug.official@gmail.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-800 text-center text-gray-500 dark:text-gray-400 text-xs tracking-widest uppercase">
          <p>© {new Date().getFullYear()} {t('all_rights_reserved')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
