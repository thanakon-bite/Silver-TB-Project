import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errorMessage';
import { baht, dateTime, thaiDateTime, ORDER_STATUS_STYLE, orderStatusKey } from '../lib/format';
import type { Order } from '../lib/types';
import { EmptyState, ErrorBox, PageHeader } from '../component/ui/Feedback';
import { primaryButtonInline } from '../component/ui/buttonStyles';

/** The Order Status as customers read it (CONTEXT.md); a refunded cancellation says so. */

const Orders: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Order[]>('/orders').then(setOrders).catch((e) => setError(errorMessage(e, t)));
  }, [t]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <PageHeader title={t('order_page.my_orders')} />

      <div className="mt-6">
        {error && <ErrorBox title={t('orders_page.load_error')}>{error}</ErrorBox>}
        {!orders && !error && (
          <p role="status" className="text-sm text-muted">
            {t('orders_page.loading')}
          </p>
        )}

        {orders && orders.length === 0 && (
          <EmptyState
            icon={<Package className="h-10 w-10" aria-hidden />}
            title={t('orders_page.empty_title')}
            text={t('orders_page.empty_text')}
            action={
              <Link to="/" className={primaryButtonInline}>
                {t('shop_now')}
              </Link>
            }
          />
        )}

        {orders && orders.length > 0 && (
          <ul className="divide-y divide-line border-b border-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="group flex items-center gap-4 py-4 transition-colors hover:bg-sunken/60 motion-reduce:transition-none sm:px-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium tabular-nums text-ink">{o.order_number}</span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ORDER_STATUS_STYLE[o.status]}`}>{t(`order_status.${orderStatusKey(o)}`)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {isThai ? thaiDateTime(o.created_at) : dateTime(o.created_at)} · {o.order_items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
                    </p>
                    {o.tracking_number && (
                      <p className="mt-1 text-xs text-muted">
                        {o.carrier} · <span className="font-mono tabular-nums">{o.tracking_number}</span>
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-sm font-medium tabular-nums text-ink">{baht(o.total)}</span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted transition-colors group-hover:text-ink" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Orders;
