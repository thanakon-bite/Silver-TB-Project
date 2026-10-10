import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ShieldCheck, Truck, Sprout } from 'lucide-react';
import { SOCIAL_LINKS } from '../component/brand/social';
import { primaryButtonInline } from '../component/ui/buttonStyles';
import { PageHeader } from '../component/ui/Feedback';

const FACTS = [
  { titleKey: 'metamorphosis', bodyKey: 'metamorphosis_desc' },
  { titleKey: 'global_diversity', bodyKey: 'global_diversity_desc' },
  { titleKey: 'diet_habitat', bodyKey: 'diet_habitat_desc' },
  { titleKey: 'trophy_horns', bodyKey: 'trophy_horns_desc' },
];

const PROMISES = [
  { icon: ShieldCheck, titleKey: 'health_guarantee', descriptionKey: 'health_guarantee_desc' },
  { icon: Truck, titleKey: 'express_shipping', descriptionKey: 'express_shipping_desc' },
  { icon: Sprout, titleKey: 'expert_bred', descriptionKey: 'expert_bred_desc' },
];

const container = 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8';
const sectionHeading = 'font-display text-2xl font-bold text-ink sm:text-3xl';

/** Who the shop is: its promises, what to know about beetles, where its community gathers. Contact details live on /contact. */
const About: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <div className={`${container} pb-10 pt-8 sm:pt-12`}>
        <PageHeader title={t('about')} description={t('about_subtitle')} />
      </div>

      <section aria-label={t('home_page.promises')} className="border-y border-line bg-sunken">
        <ul className={`${container} grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0`}>
          {PROMISES.map(({ icon: Icon, titleKey, descriptionKey }) => (
            <li key={titleKey} className="flex items-start gap-3 py-6 md:px-6 md:first:pl-0 md:last:pr-0">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" aria-hidden />
              <div>
                <h2 className="text-base font-semibold text-ink">{t(titleKey)}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t(descriptionKey)}</p>
                {titleKey === 'health_guarantee' && (
                  <Link to="/shipping#guarantee" className="mt-1 inline-block text-sm font-medium text-accent-strong underline-offset-4 hover:underline">
                    {t('home_page.guarantee_terms')}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${container} py-16 sm:py-20`}>
        <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 className={sectionHeading}>{t('know_your_beetle')}</h2>
            <p className="mt-3 text-muted">{t('understanding_beetle')}</p>
          </div>
          <dl className="grid gap-x-10 sm:grid-cols-2">
            {FACTS.map((f) => (
              <div key={f.titleKey} className="border-t border-line py-5">
                <dt className="font-display text-lg font-bold text-ink">{t(f.titleKey)}</dt>
                <dd className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{t(f.bodyKey)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={`${container} pb-16 sm:pb-20`}>
        <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 className={sectionHeading}>{t('join_community')}</h2>
            <p className="mt-3 text-muted">{t('community_desc')}</p>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {SOCIAL_LINKS.map(({ label, url, descriptionKey, Icon }) => (
              <li key={label}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 py-4 transition-colors hover:bg-sunken/60 motion-reduce:transition-none sm:px-2"
                >
                  <Icon className="h-6 w-6 shrink-0 text-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{label}</span>
                    <span className="block text-sm text-muted">{t(descriptionKey)}</span>
                  </span>
                  <ArrowUpRight className="h-5 w-5 shrink-0 text-muted transition-colors group-hover:text-accent-strong" aria-hidden />
                  <span className="sr-only">({t('home_page.opens_new_tab')})</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className={`${container} flex flex-col items-start gap-6 py-14 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="max-w-xl">
            <h2 className={sectionHeading}>{t('ready_to_start')}</h2>
            <p className="mt-2 text-muted">{t('ready_to_start_desc')}</p>
          </div>
          <Link to="/" className={primaryButtonInline}>
            {t('shop_now')}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default About;
