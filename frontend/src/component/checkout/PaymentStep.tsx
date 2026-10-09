import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { AlertCircle, Clock, Lock } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { baht } from '../../lib/format';
import type { Order } from '../../lib/types';

const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
// Load Stripe.js only when a payment form is actually shown
let stripePromise: ReturnType<typeof loadStripe> | null = null;
const getStripe = () => (publishableKey ? (stripePromise ??= loadStripe(publishableKey)) : null);

interface Props {
  order: Order;
  /** Called after Stripe accepts the payment in the browser. The order is only "paid" once the server's webhook confirms it. */
  onSubmitted: () => void;
  onExpired?: () => void;
}

function useCountdown(expiresAt: string | null) {
  const [left, setLeft] = useState(() => (expiresAt ? new Date(expiresAt).getTime() - Date.now() : null));
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setLeft(new Date(expiresAt).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return left;
}

const PayForm: React.FC<{ order: Order; onSubmitted: () => void }> = ({ order, onSubmitted }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Redirect-based methods (3-D Secure, some wallets) come back to the order page,
        // which waits for the server-verified status.
        return_url: `${window.location.origin}/orders/${order.id}?paid=1`,
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message || 'Payment failed. Please try again.');
      setProcessing(false);
      return;
    }
    // Do NOT treat this as paid. Hand over to the order page, which polls the server.
    onSubmitted();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p className="text-sm text-red-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}
      <button
        disabled={processing || !stripe || !elements}
        className="w-full py-3.5 bg-orange-gradient text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Lock className="w-4 h-4" />
        {processing ? 'Processing…' : `Pay ${baht(order.total)}`}
      </button>
      <p className="text-xs text-center text-gray-400">Payments are processed securely by Stripe. We never see your card details.</p>
    </form>
  );
};

const PaymentStep: React.FC<Props> = ({ order, onSubmitted, onExpired }) => {
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const left = useCountdown(order.expires_at);

  useEffect(() => {
    let cancelled = false;
    setClientSecret('');
    setError('');
    api
      .post<{ client_secret: string }>('/payments/create-payment-intent', { order_id: order.id })
      .then((d) => !cancelled && setClientSecret(d.client_secret))
      .catch((err: ApiError) => {
        if (cancelled) return;
        if (err.code === 'ORDER_EXPIRED') onExpired?.();
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  useEffect(() => {
    if (left !== null && left <= 0) onExpired?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left !== null && left <= 0]);

  const stripe = getStripe();
  if (!stripe) {
    return <p className="text-red-600 text-sm">Payments are not configured (missing REACT_APP_STRIPE_PUBLISHABLE_KEY).</p>;
  }

  const mins = left !== null ? Math.max(0, Math.floor(left / 60000)) : null;
  const secs = left !== null ? Math.max(0, Math.floor((left % 60000) / 1000)) : null;

  return (
    <div className="space-y-5">
      {mins !== null && (
        <div className="p-3 bg-orange/10 text-gray-800 rounded-xl flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-orange shrink-0" />
          Your items are reserved for{' '}
          <strong>
            {mins}:{String(secs).padStart(2, '0')}
          </strong>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !clientSecret && <p className="text-sm text-gray-500">Preparing secure payment…</p>}
      {clientSecret && (
        <Elements
          stripe={stripe}
          options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#FF922B' } } }}
        >
          <PayForm order={order} onSubmitted={onSubmitted} />
        </Elements>
      )}
    </div>
  );
};

export default PaymentStep;
