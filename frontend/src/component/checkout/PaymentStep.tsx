import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, Lock } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { baht } from '../../lib/format';
import type { Order } from '../../lib/types';

interface Props {
  order: Order;
  onExpired?: () => void;
}

function useCountdown(expiresAt: string | null) {
  const [left, setLeft] = useState(() => (expiresAt ? new Date(expiresAt).getTime() - Date.now() : null));
  useEffect(() => {
    if (!expiresAt) return;
    setLeft(new Date(expiresAt).getTime() - Date.now());
    const t = setInterval(() => setLeft(new Date(expiresAt).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return left;
}

/**
 * Sends the customer to Stripe's hosted Checkout page (card + PromptPay).
 * Stripe redirects back to /orders/:id?paid=1, where the order page waits for the
 * server-verified webhook. The redirect itself never marks the order paid.
 */
const PaymentStep: React.FC<Props> = ({ order, onExpired }) => {
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');
  const left = useCountdown(order.expires_at);

  useEffect(() => {
    if (left !== null && left <= 0) onExpired?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left !== null && left <= 0]);

  const pay = async () => {
    setRedirecting(true);
    setError('');
    try {
      const { url } = await api.post<{ url: string }>('/payments/checkout-session', { order_id: order.id });
      window.location.assign(url);
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'ORDER_EXPIRED') onExpired?.();
      setError(e.message);
      setRedirecting(false);
    }
  };

  const mins = left !== null ? Math.max(0, Math.floor(left / 60000)) : null;
  const secs = left !== null ? Math.max(0, Math.floor((left % 60000) / 1000)) : null;

  return (
    <div className="space-y-5">
      {mins !== null && (
        <div className="p-3 bg-orange/10 text-gray-800 dark:text-gray-200 rounded-xl flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-orange shrink-0" />
          Your items are reserved for{' '}
          <strong>
            {mins}:{String(secs).padStart(2, '0')}
          </strong>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}
      <button
        onClick={pay}
        disabled={redirecting}
        className="w-full py-3.5 bg-orange-gradient text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Lock className="w-4 h-4" />
        {redirecting ? 'Opening secure payment…' : `Pay ${baht(order.total)} · Card / PromptPay`}
      </button>
      <p className="text-xs text-center text-gray-400">
        You'll pay on Stripe's secure page, then come back here. We never see your card details.
      </p>
    </div>
  );
};

export default PaymentStep;
