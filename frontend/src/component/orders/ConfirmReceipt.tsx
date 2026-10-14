import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, PackageCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errorMessage';
import type { Order } from '../../lib/types';

/** The customer says their Shipping order arrived; the order becomes Confirmed. */
const ConfirmReceipt: React.FC<{ order: Order; onConfirmed: (o: Order) => void }> = ({ order, onConfirmed }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      onConfirmed(await api.post<Order>(`/orders/${order.id}/confirm`, {}));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('order_page.confirm_receipt_hint')}</p>
      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-accent-strong px-5 py-3 font-semibold text-accent-ink disabled:opacity-60"
      >
        <PackageCheck className="h-4 w-4" aria-hidden />
        {busy ? t('order_page.confirming_receipt') : t('order_page.confirm_receipt')}
      </button>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default ConfirmReceipt;
