import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { baht } from '../../lib/format';

export interface SummaryLine {
  key: string;
  name: string;
  quantity: number;
  amount: number | string;
  image?: string;
}

interface Props {
  lines: SummaryLine[];
  /** null while the Shipping Fee is still loading. */
  shippingFee: number | string | null;
  total: number | string;
  totalLabel: string;
  note?: string;
}

/**
 * What the customer is paying for. Beside the form on wide screens (sticky); folded into a bar with
 * the total on small screens, so the form comes first but the amount is never out of sight.
 */
const OrderSummary: React.FC<Props> = ({ lines, shippingFee, total, totalLabel, note }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const fee =
    shippingFee === null ? '–' : Number(shippingFee) > 0 ? baht(shippingFee) : <span className="font-medium text-success">{t('checkout_page.free')}</span>;

  return (
    <section aria-label={t('checkout_page.summary')} className="lg:sticky lg:top-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 border-y border-line py-3 text-sm text-ink lg:hidden"
      >
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium">
          {open ? t('checkout_page.hide_summary') : t('checkout_page.show_summary')}
          <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
        <span className="font-mono font-medium tabular-nums">{baht(total)}</span>
      </button>

      <div id={panelId} className={`${open ? 'block' : 'hidden'} pt-4 lg:block lg:rounded-2xl lg:border lg:border-line lg:bg-sunken lg:p-5`}>
        <h2 className="mb-4 hidden font-display text-lg font-bold text-ink lg:block">{t('checkout_page.summary')}</h2>
        <ul className="space-y-3">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3">
              {l.image ? (
                <img src={l.image} alt={l.name} className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover" />
              ) : (
                <span className="h-12 w-12 shrink-0 rounded-lg border border-line bg-paper" aria-hidden />
              )}
              <span className="min-w-0 flex-1 text-sm text-ink">
                <span className="block truncate">{l.name}</span>
                <span className="font-mono text-xs text-muted">×{l.quantity}</span>
              </span>
              <span className="font-mono text-sm tabular-nums text-ink">{baht(l.amount)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between text-muted">
            <dt>{t('checkout_page.shipping_fee')}</dt>
            <dd className="font-mono tabular-nums">{fee}</dd>
          </div>
          <div className="flex items-baseline justify-between text-ink">
            <dt className="font-semibold">{totalLabel}</dt>
            <dd className="font-mono text-lg font-medium tabular-nums">{baht(total)}</dd>
          </div>
        </dl>
        {note && <p className="mt-3 text-xs text-muted">{note}</p>}
      </div>
    </section>
  );
};

export default OrderSummary;
