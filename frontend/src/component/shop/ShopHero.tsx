import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import BeetleMark from '../brand/BeetleMark';
import { SOCIAL_LINKS } from '../brand/social';
import { primaryButtonInline, secondaryButton } from '../ui/buttonStyles';

/**
 * The shop's name and promise above its products. Kept short so the first row of products
 * still shows on a laptop screen without scrolling.
 */
const ShopHero: React.FC<{ productsId: string }> = ({ productsId }) => {
  const { t } = useTranslation();

  const toProducts = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(productsId);
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  };

  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_14rem] lg:px-8">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-bold leading-[1.1] text-ink sm:text-5xl">Silver Thief Bug</h1>
          <p className="mt-3 text-lg font-medium text-accent-strong">{t('hero_subtitle')}</p>
          <p className="mt-4 max-w-xl leading-relaxed text-muted sm:text-lg">{t('hero_desc_long')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={`#${productsId}`} onClick={toProducts} className={primaryButtonInline}>
              {t('explore_collection')}
              <ArrowDown className="h-5 w-5" aria-hidden />
            </a>
            <a href={SOCIAL_LINKS[0].url} target="_blank" rel="noopener noreferrer" className={`${secondaryButton} py-3.5 text-base`}>
              {t('follow_facebook')}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
        <BeetleMark className="mx-auto hidden h-44 w-44 text-accent/70 lg:block" />
      </div>
    </section>
  );
};

export default ShopHero;
