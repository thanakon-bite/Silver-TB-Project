import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** The shop shows this many product cards a page. */
export const SHOP_PAGE_SIZE = 20;

const step =
  'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-ink transition-colors hover:border-muted disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none';

/** Page numbers to offer: the first, the last, and the ones around the current page; gaps become "…". */
function pageList(page: number, pages: number): (number | 'gap')[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = Array.from(keep).sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? (['gap', n] as const) : [n]));
}

/** Previous / page numbers / next under the product grid. Hidden when everything fits on one page. */
const ShopPager: React.FC<{ page: number; total: number; onPage: (page: number) => void }> = ({ page, total, onPage }) => {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav aria-label={t('products_page.pages')} className="mt-8 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={step}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> {t('products_page.previous')}
        </button>
        {pageList(page, pages).map((n, i) =>
          n === 'gap' ? (
            <span key={`gap-${i}`} aria-hidden className="px-1 text-muted">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-label={t('products_page.page_n', { n })}
              aria-current={n === page ? 'page' : undefined}
              className={`${step} font-mono tabular-nums ${n === page ? 'border-accent-strong bg-accent-strong text-accent-ink' : ''}`}
            >
              {n}
            </button>
          )
        )}
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={step}>
          {t('products_page.next')} <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {t('products_page.page_summary', { page, pages, count: total })}
      </p>
    </nav>
  );
};

export default ShopPager;
