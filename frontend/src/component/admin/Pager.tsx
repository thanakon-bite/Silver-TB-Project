import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Every admin list shows this many rows per page. */
export const PAGE_SIZE = 10;

const step =
  'inline-flex h-9 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-ink transition-colors hover:border-muted disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none';

/** Previous / next and where the admin is in the list. A new search or filter should go back to page 1. */
const Pager: React.FC<{ page: number; total: number; onPage: (page: number) => void }> = ({ page, total, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted" aria-live="polite">
        Page <span className="font-mono tabular-nums text-ink">{page}</span> of <span className="font-mono tabular-nums text-ink">{pages}</span> ·{' '}
        <span className="font-mono tabular-nums">{total}</span> {total === 1 ? 'item' : 'items'}
      </p>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={step}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
        </button>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={step}>
          Next <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
};

export default Pager;
