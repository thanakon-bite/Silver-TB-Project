import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Clock, Lock } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { baht } from '../../lib/format';
import type { Order } from '../../lib/types';
import { primaryButton } from '../ui/buttonStyles';
import { errorMessage } from '../../lib/errorMessage';

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
  const { t } = useTranslation();
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
      setError(errorMessage(e, t));
      setRedirecting(false);
    }
  };

  const mins = left !== null ? Math.max(0, Math.floor(left / 60000)) : null;
  const secs = left !== null ? Math.max(0, Math.floor((left % 60000) / 1000)) : null;

  return (
    <div className="space-y-5">
      {mins !== null && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Clock className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
          {t('checkout_page.reserved_for')}{' '}
          <strong className="font-mono font-medium tabular-nums text-ink">
            {mins}:{String(secs).padStart(2, '0')}
          </strong>
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}
      <div>
        <button type="button" onClick={pay} disabled={redirecting} className={primaryButton}>
          <Lock className="h-4 w-4" aria-hidden />
          {redirecting ? t('checkout_page.opening_payment') : t('checkout_page.pay_button', { amount: baht(order.total) })}
        </button>
        <p className="mt-2 text-sm text-muted">{t('checkout_page.pay_methods')}</p>
      </div>
      <p className="text-xs text-muted">{t('checkout_page.pay_note')}</p>
    </div>
  );
};

export default PaymentStep;
