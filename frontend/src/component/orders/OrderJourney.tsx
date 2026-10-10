import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { thaiDateTime } from '../../lib/format';
import type { Order } from '../../lib/types';

/** Copies the Tracking Number; the label itself confirms it, no toast. */
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* clipboard blocked: the number is still on screen to select */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="whitespace-nowrap rounded-xl px-2 py-1 text-sm font-medium text-accent-strong underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      {copied ? t('order_page.copied') : t('order_page.copy')}
    </button>
  );
};

/**
 * Where the Order is: ordered → paid → shipped, plus delivered once the admin has marked it.
 * Delivered is optional (CONTEXT.md), so it never shows as a step still to come.
 */
const OrderJourney: React.FC<{ order: Order }> = ({ order }) => {
  const { t } = useTranslation();
  const steps = [
    { key: 'placed', at: order.created_at },
    { key: 'paid', at: order.paid_at },
    { key: 'shipped', at: order.shipped_at },
    ...(order.delivered_at ? [{ key: 'delivered', at: order.delivered_at }] : []),
  ];

  return (
    <ol aria-label={t('order_page.journey')} className="border-l border-line pl-5">
      {steps.map((s) => (
        <li key={s.key} className="relative pb-5 last:pb-0">
          <span
            aria-hidden
            className={`absolute -left-7 top-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
              s.at ? 'border-accent-strong bg-accent-strong text-accent-ink' : 'border-line bg-paper'
            }`}
          >
            {s.at && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          <p className={`text-sm ${s.at ? 'font-semibold text-ink' : 'text-muted'}`}>{t(`order_page.step_${s.key}`)}</p>
          {s.at && <p className="font-mono text-xs tabular-nums text-muted">{thaiDateTime(s.at)}</p>}
          {s.key === 'shipped' && order.tracking_number && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span>
                {order.carrier ? `${order.carrier} · ` : ''}
                {t('order_page.tracking_number')}
              </span>
              <span className="font-mono tabular-nums text-ink">{order.tracking_number}</span>
              <CopyButton text={order.tracking_number} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
};

export default OrderJourney;
