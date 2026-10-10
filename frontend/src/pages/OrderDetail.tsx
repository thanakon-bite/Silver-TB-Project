import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Truck, PackageCheck, XCircle, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errorMessage';
import { dateTime, formatAddressLines } from '../lib/format';
import type { Order } from '../lib/types';
import { useCart } from '../contexts/CartContext';
import PaymentStep from '../component/checkout/PaymentStep';
import OrderSummary from '../component/checkout/OrderSummary';

const POLL_MS = 2000;
const MAX_POLLS = 45; // ~90 seconds

const isPayable = (o: Order) =>
  o.status === 'pending' && ['unpaid', 'failed'].includes(o.payment_status) && (!o.expires_at || new Date(o.expires_at) > new Date());

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
  const polls = useRef(0);

  const load = useCallback(async () => {
    const o = await api.get<Order>(`/orders/${id}`);
    setOrder(o);
    return o;
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(errorMessage(e, t)));
  }, [load, t]);

  // After checkout we wait for the SERVER (Stripe webhook) to confirm the payment.
  useEffect(() => {
    if (!waiting) return;
    polls.current = 0;
    const timer = setInterval(async () => {
      polls.current += 1;
      try {
        const o = await load();
        if (o.payment_status === 'paid') {
          clearInterval(timer);
          setWaiting(false);
          clearCart();
          try {
            sessionStorage.removeItem('stb_checkout_request');
          } catch {
            /* ignore */
          }
          setParams({}, { replace: true });
        }
      } catch {
        /* keep polling */
      }
      if (polls.current >= MAX_POLLS) {
        clearInterval(timer);
        setWaiting(false);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load, clearCart, setParams]);

  const cancel = async () => {
    const r = await Swal.fire({
      icon: 'warning',
      title: 'Cancel this order?',
      text: 'Your reserved items will be released.',
      showCancelButton: true,
      confirmButtonColor: '#FF922B',
      confirmButtonText: 'Cancel order',
      cancelButtonText: 'Keep it',
    });
    if (!r.isConfirmed) return;
    try {
      setOrder(await api.post<Order>(`/orders/${id}/cancel`, {}));
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Could not cancel', text: e.message });
    }
  };

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

  const steps = [
    { key: 'placed', label: 'Order placed', at: order.created_at, done: true, icon: Clock },
    { key: 'paid', label: 'Payment confirmed', at: order.paid_at, done: !!order.paid_at, icon: CheckCircle2 },
    { key: 'shipped', label: 'Shipped', at: order.shipped_at, done: !!order.shipped_at, icon: Truck },
    { key: 'delivered', label: 'Delivered', at: order.delivered_at, done: !!order.delivered_at, icon: PackageCheck },
  ];

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
              <div className="p-4 rounded-xl bg-blue-50 text-blue-800 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                Confirming your payment with the bank… this usually takes a few seconds.
              </div>
            )}
            {!waiting && justPaid && order.payment_status !== 'paid' && order.status === 'pending' && (
              <div className="p-4 rounded-xl bg-yellow-50 text-yellow-800 text-sm">
                We haven't received confirmation yet. If you completed the payment, this page will update shortly — no need to pay again.
              </div>
            )}
            {order.payment_status === 'paid' && order.status === 'paid' && (
              <div className="p-4 rounded-xl bg-green-50 text-green-800 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" /> Payment received — thank you! We're preparing your beetles.
              </div>
            )}
            {order.status === 'cancelled' && (
              <div className="p-4 rounded-xl bg-gray-100 text-gray-700 flex items-center gap-3">
                <XCircle className="w-5 h-5" />
                This order was cancelled{order.payment_status === 'refunded' ? ' and refunded' : ''}.
              </div>
            )}

            {order.status !== 'cancelled' && (
              <ol className="grid grid-cols-4 gap-2">
                {steps.map((s) => (
                  <li key={s.key} className="text-center">
                    <s.icon className={`w-6 h-6 mx-auto mb-1 ${s.done ? 'text-orange' : 'text-gray-300'}`} />
                    <p className={`text-xs font-semibold ${s.done ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</p>
                    {s.at && <p className="text-[11px] text-gray-400">{dateTime(s.at)}</p>}
                  </li>
                ))}
              </ol>
            )}

            {order.tracking_number && (
              <div className="text-sm">
                <p className="font-semibold text-gray-900 mb-1">Tracking</p>
                <p className="text-gray-600">
                  {order.carrier}: <span className="font-mono">{order.tracking_number}</span>
                </p>
              </div>
            )}

            <section className="border-y border-line py-4 text-sm text-muted">
              <h2 className="mb-2 font-display text-lg font-bold text-ink">{t('order_page.shipping_to')}</h2>
              {formatAddressLines(order.shipping_address).map((l, i) => (
                <div key={i} className={i === 0 ? 'font-semibold text-ink' : ''}>
                  {l}
                </div>
              ))}
            </section>

            {isPayable(order) && !waiting && (
              <div className="space-y-4">
                <PaymentStep order={order} onExpired={() => load()} />
                <button onClick={cancel} className="text-sm text-muted hover:text-danger">
                  Cancel order
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
