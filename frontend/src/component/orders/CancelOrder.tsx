import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { errorMessage } from '../../lib/errorMessage';
import type { Order } from '../../lib/types';
import { dangerButton, dangerLink, secondaryButton } from '../ui/buttonStyles';

interface Props {
  order: Order;
  onCancelled: (order: Order) => void;
  /** The server says the order was paid after all: show the truth instead of an error. */
  onAlreadyPaid: () => void;
}

/**
 * Cancelling releases reserved stock (often a one-of-a-kind beetle) and cannot be undone,
 * so it is confirmed in place, with focus on the safe choice. No popup.
 */
const CancelOrder: React.FC<Props> = ({ order, onCancelled, onAlreadyPaid }) => {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keepRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
    else if (wasConfirming.current) openRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      onCancelled(await api.post<Order>(`/orders/${order.id}/cancel`, {}));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_PAID') {
        onAlreadyPaid();
        return;
      }
      setError(errorMessage(err, t));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">{t('order_page.cancel_error')}</strong> · {error}
          </p>
        </div>
      )}
      {confirming ? (
        <div className="border-t border-line pt-4">
          <p className="text-sm text-ink">{t('order_page.cancel_question')}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              ref={keepRef}
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className={secondaryButton}
            >
              {t('order_page.cancel_keep')}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className={dangerButton}
            >
              {busy ? t('order_page.cancelling') : t('order_page.cancel_confirm')}
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={openRef}
          type="button"
          onClick={() => setConfirming(true)}
          className={dangerLink}
        >
          {t('order_page.cancel')}
        </button>
      )}
    </div>
  );
};

export default CancelOrder;
