import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Mail, ArrowUpRight } from 'lucide-react';
import { SHOP_EMAIL, SHOP_MAP_URL, SHOP_PHONE, SHOP_TEL, SOCIAL_LINKS } from '../brand/social';
import { secondaryButton } from '../ui/buttonStyles';

/** Where the farm is and every way to reach the shop. One block, used by About and Contact. */
const ContactSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold text-ink">{t('our_location', 'Our Location')}</h2>
        <p className="mt-2 font-medium text-ink">{t('hq_name', 'Silver Thief Bug HQ')}</p>
        <p className="mt-1 text-muted">{t('address_full')}</p>
        <a href={SHOP_MAP_URL} target="_blank" rel="noopener noreferrer" className={`${secondaryButton} mt-4`}>
          <MapPin className="h-4 w-4" aria-hidden />
          {t('open_in_google_maps', 'Open in Google Maps')}
        </a>
        <iframe
          className="mt-6 h-72 w-full rounded-xl border border-line md:h-96"
          src="https://maps.google.com/maps?q=15.2094508,101.1492295&hl=th&z=15&output=embed"
          title={t('about_page.map_title')}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <aside className="space-y-8">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('contact_us')}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            <li>
              <a href={SHOP_TEL} className="flex items-center gap-3 py-3 text-ink hover:text-accent-strong">
                <Phone className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="font-mono tabular-nums">{SHOP_PHONE}</span>
              </a>
            </li>
            <li>
              <a href={`mailto:${SHOP_EMAIL}`} className="flex items-center gap-3 py-3 text-ink hover:text-accent-strong">
                <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="break-all">{SHOP_EMAIL}</span>
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('connect_with_us', 'Connect With Us')}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {SOCIAL_LINKS.map(({ label, url, descriptionKey, Icon }) => (
              <li key={label}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 py-3">
                  <Icon className="h-5 w-5 shrink-0 text-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{label}</span>
                    <span className="block text-xs text-muted">{t(descriptionKey)}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-accent-strong" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </section>
  );
};

export default ContactSection;
