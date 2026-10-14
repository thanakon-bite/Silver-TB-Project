import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ShieldCheck, Truck, Sprout, RefreshCw, Globe2, Leaf, Crown } from 'lucide-react';
import { PHOTOS, type BeetlePhoto } from '../lib/beetlePhotos';
import { SOCIAL_LINKS } from '../component/brand/social';
import { primaryButtonInline } from '../component/ui/buttonStyles';
import { PageHeader } from '../component/ui/Feedback';

/** Each fact gets a photo and an icon; rows alternate sides so the page reads as a story, not a list. */
const FACTS: { titleKey: string; bodyKey: string; icon: React.FC<{ className?: string }>; photo: BeetlePhoto }[] = [
  { titleKey: 'metamorphosis', bodyKey: 'metamorphosis_desc', icon: RefreshCw, photo: PHOTOS.atlasWings },
  { titleKey: 'global_diversity', bodyKey: 'global_diversity_desc', icon: Globe2, photo: PHOTOS.hercules },
  { titleKey: 'diet_habitat', bodyKey: 'diet_habitat_desc', icon: Leaf, photo: PHOTOS.stagTop },
  { titleKey: 'trophy_horns', bodyKey: 'trophy_horns_desc', icon: Crown, photo: PHOTOS.atlas },
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
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');

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

      <section aria-labelledby="know-your-beetle" className={`${container} py-16 sm:py-20`}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="know-your-beetle" className={sectionHeading}>{t('know_your_beetle')}</h2>
          <p className="mt-3 text-muted">{t('understanding_beetle')}</p>
        </div>
        <div className="mt-12 space-y-12 sm:space-y-16">
          {FACTS.map(({ titleKey, bodyKey, icon: Icon, photo }, i) => (
            <article key={titleKey} className={`grid items-center gap-6 md:grid-cols-2 md:gap-12 ${i % 2 ? 'md:[&>figure]:order-2' : ''}`}>
              <figure>
                <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-sunken">
                  <img
                    src={photo.src}
                    alt={isThai ? photo.alt.th : photo.alt.en}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100"
                  />
                </div>
                <figcaption className="mt-2 text-xs text-muted">
                  {t('hero.photo_by', { author: photo.author })} ·{' '}
                  <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                    {photo.license}
                  </a>{' '}
                  ·{' '}
                  <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                    Wikimedia Commons
                  </a>
                </figcaption>
              </figure>
              <div className="max-w-prose">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-strong/10 text-accent-strong">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl">{t(titleKey)}</h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted sm:text-base">{t(bodyKey)}</p>
              </div>
            </article>
          ))}
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
