import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { PHOTOS, type BeetlePhoto } from '../../lib/beetlePhotos';
import { primaryButtonInline } from '../ui/buttonStyles';

const SLIDE_MS = 6000;

/** One slide per Category: a beetle photo, a line about what the shop has, and a way into it. */
const SLIDES: { key: 'beetle' | 'food' | 'log' | 'gear'; photo: BeetlePhoto }[] = [
  { key: 'beetle', photo: PHOTOS.rhino },
  { key: 'food', photo: PHOTOS.flower },
  { key: 'log', photo: PHOTOS.stagLog },
  { key: 'gear', photo: PHOTOS.stagHome },
];

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * The shop's front: four photo slides that change every 6 seconds, pause while pointed at or focused,
 * and never move by themselves for people who ask for reduced motion.
 */
const ShopHero: React.FC<{ productsId: string }> = ({ productsId }) => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced] = useState(prefersReducedMotion);

  const go = useCallback((i: number) => setIndex(((i % SLIDES.length) + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused || reduced) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [paused, reduced]);

  const toProducts = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(productsId);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  };

  return (
    <section
      aria-roledescription={t('hero.carousel')}
      aria-label="Silver Thief Bug"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setPaused(false)}
      className="relative isolate overflow-hidden bg-scrim text-on-scrim"
    >
      <div className="relative h-[26rem] sm:h-[30rem] lg:h-[34rem]">
        {SLIDES.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.key}
              role="group"
              aria-roledescription={t('hero.slide')}
              aria-label={t('hero.slide_of', { n: i + 1, total: SLIDES.length })}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            >
              <img
                src={s.photo.src}
                alt={isThai ? s.photo.alt.th : s.photo.alt.en}
                loading={i === 0 ? 'eager' : 'lazy'}
                className={`absolute inset-0 h-full w-full object-cover ${active && !reduced ? 'animate-hero-zoom' : ''}`}
              />
              {/* An even scrim (design.md: no gradients) so the words read on any photo, in light and dark themes */}
              <div aria-hidden className="absolute inset-0 bg-scrim/60" />
              <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
                <div className={`max-w-xl ${active && !reduced ? 'animate-hero-rise' : ''}`}>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">{t(`hero.slides.${s.key}.eyebrow`)}</p>
                  <h2 className="mt-2 font-display text-3xl font-bold leading-tight text-on-scrim sm:text-5xl">{t(`hero.slides.${s.key}.title`)}</h2>
                  <p className="mt-3 max-w-lg text-base leading-relaxed text-on-scrim/85 sm:text-lg">{t(`hero.slides.${s.key}.text`)}</p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link to={`/?category=${s.key}`} tabIndex={active ? 0 : -1} className={primaryButtonInline}>
                      {t(`hero.slides.${s.key}.cta`)}
                      <ArrowRight className="h-5 w-5" aria-hidden />
                    </Link>
                    {i === 0 && (
                      <a
                        href={`#${productsId}`}
                        onClick={toProducts}
                        tabIndex={active ? 0 : -1}
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-3 font-semibold text-on-scrim underline-offset-4 hover:underline"
                      >
                        {t('explore_collection')}
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </a>
                    )}
                  </div>
                </div>
                <p className="absolute bottom-3 right-4 max-w-[60%] text-right text-[11px] leading-snug text-on-scrim/70 sm:right-6 lg:right-8">
                  {t('hero.photo_by', { author: s.photo.author })} ·{' '}
                  <a href={s.photo.licenseUrl} target="_blank" rel="noopener noreferrer" tabIndex={active ? 0 : -1} className="underline underline-offset-2 hover:text-on-scrim">
                    {s.photo.license}
                  </a>{' '}
                  ·{' '}
                  <a href={s.photo.sourceUrl} target="_blank" rel="noopener noreferrer" tabIndex={active ? 0 : -1} className="underline underline-offset-2 hover:text-on-scrim">
                    Wikimedia Commons
                  </a>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <h1 className="sr-only">Silver Thief Bug</h1>

      <div className="absolute bottom-4 left-4 flex items-center gap-2 sm:left-6 lg:left-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label={t('hero.previous')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-on-scrim/15 text-on-scrim backdrop-blur hover:bg-on-scrim/25"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => go(i)}
            aria-label={t('hero.go_to', { n: i + 1 })}
            aria-current={i === index ? 'true' : undefined}
            className={`h-2.5 rounded-full transition-all motion-reduce:transition-none ${i === index ? 'w-8 bg-accent' : 'w-2.5 bg-on-scrim/50 hover:bg-on-scrim/80'}`}
          />
        ))}
        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label={t('hero.next')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-on-scrim/15 text-on-scrim backdrop-blur hover:bg-on-scrim/25"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </section>
  );
};

export default ShopHero;
