import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errorMessage';
import { formatAddressLines } from '../lib/format';
import type { Order } from '../lib/types';
import { useCart } from '../contexts/CartContext';
import PaymentStep from '../component/checkout/PaymentStep';
import OrderSummary from '../component/checkout/OrderSummary';
import OrderJourney from '../component/orders/OrderJourney';
import CancelOrder from '../component/orders/CancelOrder';

const POLL_MS = 2000;
const MAX_POLLS = 45; // ~90 seconds

const reservationOver = (o: Order) => !!o.expires_at && new Date(o.expires_at) <= new Date();

const isPayable = (o: Order) => o.status === 'pending' && ['unpaid', 'failed'].includes(o.payment_status) && !reservationOver(o);

/** A quiet status line on the sunken panel; errors use the danger box instead (design.md). */
const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="status" className="flex items-start gap-2 rounded-xl border border-line bg-sunken p-3 text-sm text-ink">
    {children}
  </div>
);

/** The Order Status as customers read it (CONTEXT.md); a refunded cancellation says so. */
const statusKey = (o: Order) => (o.status === 'cancelled' && o.payment_status === 'refunded' ? 'cancelled_refunded' : o.status);

const OrderDetail: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { clearCart } = useCart();
  const justPaid = params.get('paid') === '1';

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(justPaid);
  const [thanked, setThanked] = useState(false);

  const load = useCallback(async () => {
    const o = await api.get<Order>(`/orders/${id}`);
    setOrder(o);
    return o;
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(errorMessage(e, t)));
  }, [load, t]);

  // Back from Stripe (?paid=1): only the SERVER (verified webhook) makes an order Paid, so poll for it.
  useEffect(() => {
    if (!waiting) return;
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      load().catch(() => {
        /* keep polling */
      });
      if (polls >= MAX_POLLS) setWaiting(false);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  // Seeing this order Paid on the way back from Stripe ends the purchase, whenever the webhook landed:
  // empty the Cart once. Opening an old order without ?paid=1 never touches the Cart.
  useEffect(() => {
    if (!justPaid || order?.payment_status !== 'paid') return;
    setWaiting(false);
    setThanked(true);
    clearCart();
    try {
      sessionStorage.removeItem('stb_checkout_request');
    } catch {
      /* ignore */
    }
    setParams({}, { replace: true });
  }, [justPaid, order, clearCart, setParams]);

  if (error) {
    return (
      <div className="bg-paper text-ink">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p>
                <strong className="font-semibold">{t('order_page.load_error')}</strong> · {error}
              </p>
              <Link to="/orders" className="mt-1 inline-block font-medium text-accent-strong underline-offset-4 hover:underline">
                {t('order_page.my_orders')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="bg-paper">
        <p role="status" className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted sm:px-6">
          {t('order_page.loading')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-paper text-ink">
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        <Link to="/orders" className="whitespace-nowrap text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          {t('order_page.back_to_orders')}
        </Link>

        <div className="mb-8 mt-4">
          <h1 className="font-display text-3xl font-bold text-ink">{t(`order_status.${statusKey(order)}`)}</h1>
          <p className="mt-1 font-mono text-sm text-muted">{t('order_page.order_number', { number: order.order_number })}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="lg:order-2">
            <OrderSummary
              lines={order.order_items.map((i) => ({
                key: i.id,
                name: i.product_name,
                quantity: i.quantity,
                amount: i.line_total,
                image: i.product_image || undefined,
              }))}
              shippingFee={order.shipping_fee}
              total={order.total}
              totalLabel={t('checkout_page.total')}
            />
          </div>

          <div className="min-w-0 space-y-8 lg:order-1">
            {waiting && order.payment_status !== 'paid' && (
              <Notice>
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent-strong motion-reduce:animate-none" aria-hidden />
                <p>{t('order_page.confirming')}</p>
              </Notice>
            )}
            {!waiting && justPaid && order.payment_status !== 'paid' && order.status === 'pending' && (
              <Notice>
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                <p>
                  <strong className="font-semibold">{t('order_page.not_confirmed_title')}</strong> · {t('order_page.not_confirmed_text')}
                </p>
              </Notice>
            )}
            {order.status === 'paid' && (
              <Notice>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                <p>
                  {thanked && <strong className="font-semibold">{t('order_page.paid_thanks')} · </strong>}
                  {t('order_page.preparing')}
                </p>
              </Notice>
            )}

            {order.status !== 'cancelled' && <OrderJourney order={order} />}

            <section className="border-y border-line py-4 text-sm text-muted">
              <h2 className="mb-2 font-display text-lg font-bold text-ink">{t('order_page.shipping_to')}</h2>
              {formatAddressLines(order.shipping_address).map((l, i) => (
                <div key={i} className={i === 0 ? 'font-semibold text-ink' : ''}>
                  {l}
                </div>
              ))}
            </section>

            {order.status === 'pending' && order.payment_status !== 'paid' && reservationOver(order) && !waiting && (
              <Notice>
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                <p>
                  <strong className="font-semibold">{t('order_page.expired_title')}</strong> · {t('order_page.expired_text')}{' '}
                  <Link to="/products" className="whitespace-nowrap font-medium text-accent-strong underline-offset-4 hover:underline">
                    {t('order_page.keep_shopping')}
                  </Link>
                </p>
              </Notice>
            )}

            {isPayable(order) && !waiting && (
              <div className="space-y-5">
                {order.payment_status === 'failed' && (
                  <Notice>
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                    <p>
                      <strong className="font-semibold">{t('order_page.failed_title')}</strong> · {t('order_page.failed_text')}
                    </p>
                  </Notice>
                )}
                {/* When the countdown ends, reload: the order is then shown as expired instead of payable. */}
                <PaymentStep order={order} onExpired={() => load().catch(() => {})} />
                <CancelOrder order={order} onCancelled={setOrder} onAlreadyPaid={() => load().catch(() => {})} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
