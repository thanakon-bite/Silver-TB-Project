import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { PolicyPage } from '../component/content/PolicyPage';
import { PUBLISHED } from '../component/content/published';
import { textLink } from '../component/ui/buttonStyles';

const UPDATED = '2026-10-10';

interface Question {
  q: string;
  a: string;
  /** A page that holds the full rule, e.g. "/shipping#guarantee". The answer never restates it. */
  link?: string;
}
interface Group {
  id: string;
  title: string;
  items: Question[];
}

/**
 * Questions answered from how the shop actually works. Rules that live in the shipping policy are only
 * summarised here and linked, never restated. The reservation ("at least 30 minutes") is written in the copy,
 * here and in the terms: change both with ORDER_RESERVATION_MINUTES on the server (ADR 0001 extends it for Stripe).
 */
const Faq: React.FC = () => {
  const { t } = useTranslation();
  const groups = t('faq_page.groups', { returnObjects: true }) as unknown as Group[];
  const care = t('faq_page.care', { returnObjects: true }) as unknown as Group;
  const shown = PUBLISHED.faqCare ? [...groups, care] : groups;

  return (
    <PolicyPage title={t('faq')} description={t('faq_page.description')} updated={UPDATED}>
      {shown.map((g) => (
        <section key={g.id} aria-labelledby={`faq-${g.id}`}>
          <h2 id={`faq-${g.id}`} className="font-display text-xl font-bold text-ink">
            {g.title}
          </h2>
          <div className="mt-3 divide-y divide-line border-y border-line">
            {g.items.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[0.9375rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="pb-4 text-[0.9375rem] leading-relaxed text-muted">
                  <p>{item.a}</p>
                  {item.link && (
                    <Link to={item.link} className={`${textLink} mt-2 inline-block`}>
                      {t('faq_page.read_more')}
                    </Link>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </PolicyPage>
  );
};

export default Faq;
