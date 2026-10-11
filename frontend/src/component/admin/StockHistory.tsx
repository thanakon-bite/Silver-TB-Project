import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import Modal from '../common/Modal';
import { errorMessage } from '../../lib/errorMessage';
import { ErrorBox } from '../ui/Feedback';

/** One Stock Change as the admin API returns it (CONTEXT.md: Stock History). */
export interface StockChange {
  id: number;
  kind: 'opening' | 'created' | 'set_on_hand' | 'order_created' | 'order_cancelled' | 'order_confirmed' | 'other';
  on_hand_delta: number;
  available_delta: number;
  on_hand_after: number;
  available_after: number;
  note: string | null;
  created_at: string;
  order_number: string | null;
  actor: string | null;
}

const PAGE = 20;

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** A product's Stock History, newest first, a page at a time. */
const StockHistory: React.FC<{ product: { id: string; name: string } | null; onClose: () => void }> = ({ product, onClose }) => {
  const { t, i18n } = useTranslation();
  const [changes, setChanges] = useState<StockChange[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setChanges([]);
    setPage(1);
    setTotal(0);
    setError('');
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    let live = true;
    setLoading(true);
    api
      .get<{ changes: StockChange[]; total: number }>(`/products/${product.id}/stock-history?page=${page}&limit=${PAGE}`)
      .then((r) => {
        if (!live) return;
        setChanges((prev) => (page === 1 ? r.changes : [...prev, ...r.changes]));
        setTotal(r.total || 0);
      })
      .catch((err) => live && setError(errorMessage(err, t)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [product, page, t]);

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language?.startsWith('en') ? 'en-GB' : 'th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });

  return (
    <Modal isOpen={product !== null} onClose={onClose} title={product ? t('admin.stock_history.title', { name: product.name }) : ''} maxWidth="3xl">
      {error && <ErrorBox>{error}</ErrorBox>}
      {!error && !loading && changes.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('admin.stock_history.empty')}</p>}
      {changes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="p-2 font-semibold">{t('admin.stock_history.when')}</th>
                <th className="p-2 font-semibold">{t('admin.stock_history.what')}</th>
                <th className="p-2 text-right font-semibold">{t('admin.products.on_hand_label')}</th>
                <th className="p-2 text-right font-semibold">{t('admin.products.available_label')}</th>
                <th className="p-2 font-semibold">{t('admin.stock_history.by')}</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id} className="border-b border-line align-top">
                  <td className="whitespace-nowrap p-2 text-muted">{when(c.created_at)}</td>
                  <td className="p-2 text-ink">
                    <div>{t(`admin.stock_history.kind.${c.kind}`)}</div>
                    {c.order_number && <div className="font-mono text-xs text-muted">{c.order_number}</div>}
                    {c.note && <div className="text-xs text-muted">“{c.note}”</div>}
                  </td>
                  <td className="whitespace-nowrap p-2 text-right font-mono tabular-nums">
                    <span className="text-ink">{c.on_hand_after}</span>
                    {c.kind !== 'opening' && c.on_hand_delta !== 0 && <span className="ml-1 text-xs text-muted">({signed(c.on_hand_delta)})</span>}
                  </td>
                  <td className="whitespace-nowrap p-2 text-right font-mono tabular-nums">
                    <span className="text-ink">{c.available_after}</span>
                    {c.kind !== 'opening' && c.available_delta !== 0 && <span className="ml-1 text-xs text-muted">({signed(c.available_delta)})</span>}
                  </td>
                  <td className="p-2 text-muted">{c.actor || (c.order_number ? t('admin.stock_history.by_order') : t('admin.stock_history.by_system'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loading && <p className="py-3 text-center text-sm text-muted">{t('loading')}</p>}
      {!loading && changes.length < total && (
        <button type="button" onClick={() => setPage((p) => p + 1)} className="mt-3 w-full rounded-lg border border-line py-2 text-sm font-medium text-ink hover:border-muted">
          {t('admin.stock_history.more')}
        </button>
      )}
    </Modal>
  );
};

export default StockHistory;
