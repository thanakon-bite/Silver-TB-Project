import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Truck, PackageCheck, XCircle, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../lib/api';
import { baht, dateTime, formatAddressLines, ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from '../lib/format';
import type { Order } from '../lib/types';
import { useCart } from '../contexts/CartContext';
import PaymentStep from '../component/checkout/PaymentStep';

const POLL_MS = 2000;
const MAX_POLLS = 45; // ~90 seconds

const isPayable = (o: Order) =>
  o.status === 'pending' && ['unpaid', 'failed'].includes(o.payment_status) && (!o.expires_at || new Date(o.expires_at) > new Date());

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { clearCart } = useCart();
  const justPaid = params.get('paid') === '1';

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(justPaid);
  const [showPay, setShowPay] = useState(false);
  const polls = useRef(0);

  const load = useCallback(async () => {
    const o = await api.get<Order>(`/orders/${id}`);
    setOrder(o);
    return o;
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

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

  if (error) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-red-600">{error}</div>;
  if (!order) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">Loading…</div>;

  const steps = [
    { key: 'placed', label: 'Order placed', at: order.created_at, done: true, icon: Clock },
    { key: 'paid', label: 'Payment confirmed', at: order.paid_at, done: !!order.paid_at, icon: CheckCircle2 },
    { key: 'shipped', label: 'Shipped', at: order.shipped_at, done: !!order.shipped_at, icon: Truck },
    { key: 'delivered', label: 'Delivered', at: order.delivered_at, done: !!order.delivered_at, icon: PackageCheck },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
      <Link to="/orders" className="text-sm text-gray-500 hover:text-orange">← My orders</Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.order_number}</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${ORDER_STATUS_STYLE[order.status]}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

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
        <ol className="grid grid-cols-4 gap-2 bg-white rounded-2xl border border-gray-100 p-5">
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
        <div className="bg-white rounded-2xl border border-gray-100 p-5 text-sm">
          <p className="font-semibold text-gray-900 mb-1">Tracking</p>
          <p className="text-gray-600">
            {order.carrier}: <span className="font-mono">{order.tracking_number}</span>
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Items</h2>
        {order.order_items.map((i) => (
          <div key={i.id} className="flex justify-between text-sm py-1.5 text-gray-700">
            <span>{i.quantity}× {i.product_name}</span>
            <span>{baht(i.line_total)}</span>
          </div>
        ))}
        {Number(order.shipping_fee) > 0 && (
          <div className="flex justify-between text-sm py-1.5 text-gray-700">
            <span>Shipping</span>
            <span>{baht(order.shipping_fee)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold border-t mt-2 pt-2">
          <span>Total</span>
          <span>{baht(order.total)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 text-sm text-gray-700">
        <h2 className="font-semibold text-gray-900 mb-2">Shipping to</h2>
        {formatAddressLines(order.shipping_address).map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>

      {isPayable(order) && !waiting && (
        <div className="bg-white rounded-2xl border border-orange/30 p-5 space-y-4">
          {!showPay ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowPay(true)} className="flex-1 py-3 bg-orange-gradient text-white font-bold rounded-xl">
                Complete payment
              </button>
              <button onClick={cancel} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:border-red-300 hover:text-red-500">
                Cancel order
              </button>
            </div>
          ) : (
            <PaymentStep
              order={order}
              onExpired={() => {
                setShowPay(false);
                load();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
