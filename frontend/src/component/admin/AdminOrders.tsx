import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Copy, Search, Truck, PackageCheck, XCircle, RotateCcw } from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../../lib/api';
import { baht, cancelReasonText, formatAddressLines, localDateTime, ORDER_STATUS_STYLE, orderStatusKey } from '../../lib/format';
import { ORDER_STATUSES, type Order, type OrderStatus } from '../../lib/types';
import Modal from '../common/Modal';
import { showAdminError } from './adminError';
import Pager, { PAGE_SIZE } from './Pager';
import Countdown from './Countdown';
import { dangerButton, dangerLink, primaryButtonInline, secondaryButton } from '../ui/buttonStyles';

const CARRIERS = ['Thailand Post (EMS)', 'Kerry Express', 'Flash Express', 'J&T Express', 'Lalamove', 'Other'];

interface Props {
  initialFilter?: string;
  initialOrderId?: string | null;
}

const AdminOrders: React.FC<Props> = ({ initialFilter, initialOrderId }) => {
  const { t, i18n } = useTranslation();
  const when = (iso: string | null | undefined) => localDateTime(iso, i18n.language);
  const statusLabel = (o: Pick<Order, 'status' | 'refunded_at'>) => t(`order_status.${orderStatusKey(o)}`);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  // The Overview opens this tab filtered by an Order Status, or by 'attention'.
  const [status, setStatus] = useState<OrderStatus | ''>(() => ((ORDER_STATUSES as readonly string[]).includes(initialFilter || '') ? (initialFilter as OrderStatus) : ''));
  const [attention, setAttention] = useState(initialFilter === 'attention');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [ship, setShip] = useState({ carrier: CARRIERS[0], tracking_number: '' });
  const [note, setNote] = useState('');
  const [cancelling, setCancelling] = useState(false);
  // The cancel form takes focus on its reason (confirm stays disabled until one is written); closing it hands focus back.
  const cancelOpenRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const wasCancelling = useRef(false);
  useEffect(() => {
    if (cancelling) reasonRef.current?.focus();
    else if (wasCancelling.current) cancelOpenRef.current?.focus();
    wasCancelling.current = cancelling;
  }, [cancelling]);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  const fetchOrders = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status) q.set('status', status);
    if (attention) q.set('needs_attention', 'true');
    if (search) q.set('search', search);
    try {
      const data = await api.get<{ orders: Order[]; total: number }>(`/orders/admin/all?${q}`);
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      showAdminError(err, t);
    }
  }, [page, status, attention, search, t]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 250);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  const openOrder = useCallback(async (id: string) => {
    try {
      const o = await api.get<Order>(`/orders/${id}`);
      setSelected(o);
      setNote(o.admin_note || '');
      setCancelling(false);
      setCancelReason('');
      setShip({ carrier: o.carrier || CARRIERS[0], tracking_number: o.tracking_number || '' });
    } catch (err: any) {
      showAdminError(err, t);
    }
  }, [t]);

  useEffect(() => {
    if (initialOrderId) openOrder(initialOrderId);
  }, [initialOrderId, openOrder]);

  const run = async (fn: () => Promise<Order>, success: string) => {
    setBusy(true);
    try {
      const o = await fn();
      setSelected(o);
      fetchOrders();
      Swal.fire({ icon: 'success', title: success, timer: 1000, showConfirmButton: false });
    } catch (err: any) {
      showAdminError(err, t);
    } finally {
      setBusy(false);
    }
  };

  const markShipping = () => {
    if (!selected) return;
    if (!ship.tracking_number.trim()) return Swal.fire(t('admin.orders.tracking_required'), '', 'warning');
    run(() => api.patch<Order>(`/orders/${selected.id}/status`, { status: 'shipping', ...ship }), t('admin.orders.marked_shipping'));
  };

  const confirmReceived = () =>
    selected && run(() => api.patch<Order>(`/orders/${selected.id}/status`, { status: 'confirmed' }), t('admin.orders.marked_received'));

  // The customer reads the Cancel Reason; a paid order is refunded in full by the same step.
  const cancelOrder = () => {
    if (!selected || !cancelReason.trim()) return;
    run(() => api.patch<Order>(`/orders/${selected.id}/status`, { status: 'cancelled', reason: cancelReason.trim() }), t('admin.orders.cancelled'));
  };

  // The note column saves on leaving the field, without opening the order.
  const saveRowNote = async (o: Order, value: string) => {
    if ((o.admin_note || '') === value) return;
    try {
      await api.patch<Order>(`/orders/${o.id}/admin`, { admin_note: value });
      setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, admin_note: value } : x)));
    } catch (err: any) {
      showAdminError(err, t);
    }
  };

  const saveNote = (resolve?: boolean) =>
    selected &&
    run(
      () => api.patch<Order>(`/orders/${selected.id}/admin`, { admin_note: note, ...(resolve ? { needs_attention: false } : {}) }),
      resolve ? t('admin.orders.resolved') : t('admin.orders.note_saved')
    );

  const copyAddress = () => {
    if (!selected) return;
    navigator.clipboard?.writeText(formatAddressLines(selected.shipping_address).join('\n'));
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: t('admin.orders.address_copied'), timer: 1000, showConfirmButton: false });
  };

  const select = 'border border-line rounded-xl px-3 py-2 text-sm bg-paper outline-none focus:ring-2 focus:ring-accent-strong/40';

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder={t('admin.orders.order_number')} aria-label={t('admin.orders.order_number')} className={`${select} pl-9`} />
        </div>
        <select aria-label={t('admin.common.status')} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as OrderStatus | ''); }} className={select}>
          <option value="">{t('admin.common.all_statuses')}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`order_status.${s}`)}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="accent-accent-strong" checked={attention} onChange={(e) => { setPage(1); setAttention(e.target.checked); }} />
          {t('admin.overview.attention')}
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken text-muted">
              <th className="p-3 font-semibold">{t('admin.orders.order')}</th>
              <th className="p-3 font-semibold">{t('admin.orders.customer')}</th>
              <th className="p-3 font-semibold text-right">{t('admin.orders.total')}</th>
              <th className="p-3 font-semibold">{t('admin.common.status')}</th>
              <th className="p-3 font-semibold">{t('admin.orders.note')}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} onClick={() => openOrder(o.id)} className="border-b border-line hover:bg-accent-strong/5 cursor-pointer">
                <td className="p-3">
                  <div className="font-mono font-semibold text-ink flex items-center gap-1.5">
                    {o.needs_attention && <AlertTriangle className="w-4 h-4 text-danger" aria-label={t('admin.overview.attention')} />}
                    {o.order_number}
                  </div>
                  <div className="text-xs text-muted">{when(o.created_at)}</div>
                </td>
                <td className="p-3 text-ink">{o.profiles?.full_name || '—'}</td>
                <td className="p-3 text-right font-semibold text-ink">{baht(o.total)}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs rounded-md font-semibold ${ORDER_STATUS_STYLE[o.status]}`}>{statusLabel(o)}</span>
                  {o.deadline && <Countdown deadline={o.deadline} />}
                </td>
                <td className="p-3 min-w-[12rem]" onClick={(e) => e.stopPropagation()}>
                  <input
                    aria-label={t('admin.orders.note_for', { number: o.order_number })}
                    defaultValue={o.admin_note || ''}
                    maxLength={2000}
                    placeholder={t('admin.orders.add_note')}
                    onBlur={(e) => saveRowNote(o, e.target.value.trim())}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full bg-transparent border border-transparent hover:border-line focus:border-line rounded-md px-2 py-1 text-sm text-ink placeholder:text-muted outline-none focus:ring-2 focus:ring-accent-strong/40"
                  />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted">{t('admin.orders.none')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} total={total} onPage={setPage} />

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? t('admin.orders.order_title', { number: selected.order_number }) : ''} maxWidth="3xl">
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className={`px-2 py-1 rounded-md font-semibold ${ORDER_STATUS_STYLE[selected.status]}`}>{statusLabel(selected)}</span>
            </div>

            {selected.needs_attention && (
              <div className="p-3 rounded-xl border border-danger/40 bg-danger/5 text-danger flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="whitespace-pre-line">{selected.admin_note || t('admin.orders.needs_check')}</div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-line p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-ink">{t('admin.orders.ship_to')}</h4>
                  <button onClick={copyAddress} className="flex items-center gap-1 text-xs text-accent-strong"><Copy className="w-3 h-3" /> {t('order_page.copy')}</button>
                </div>
                {formatAddressLines(selected.shipping_address).map((l, i) => <div key={i} className="text-ink">{l}</div>)}
              </div>
              <div className="rounded-xl border border-line p-4 space-y-1 text-ink">
                <h4 className="font-semibold text-ink mb-2">{t('admin.orders.customer_payment')}</h4>
                <div>{selected.profiles?.full_name} · {selected.profiles?.email}</div>
                <div>{t('admin.orders.placed')}: {when(selected.created_at)}</div>
                <div>{t('admin.orders.paid')}: {when(selected.paid_at)}</div>
                {selected.stripe_payment_intent_id && <div className="font-mono text-xs text-muted break-all">{selected.stripe_payment_intent_id}</div>}
                <div>{t('admin.orders.line_alert')}: {selected.admin_notified_at ? when(selected.admin_notified_at) : '—'}</div>
                {selected.cancel_reason && <div>{t('order_page.cancel_reason')}: {cancelReasonText(selected.cancel_reason, t)}</div>}
              </div>
            </div>

            <div className="rounded-xl border border-line p-4">
              {selected.order_items.map((i) => (
                <div key={i.id} className="flex justify-between py-1 text-ink">
                  <span>{i.quantity}× {i.product_name}{i.is_gift ? ` (${t('promotions.gift_label')})` : ''}</span>
                  <span>{baht(i.line_total)}</span>
                </div>
              ))}
              {Number(selected.shipping_fee) > 0 && (
                <div className="flex justify-between py-1 text-ink"><span>{t('checkout_page.shipping_fee')}</span><span>{baht(selected.shipping_fee)}</span></div>
              )}
              <div className="flex justify-between font-bold border-t border-line mt-2 pt-2"><span>{t('admin.orders.total')}</span><span>{baht(selected.total)}</span></div>
            </div>

            {/* Fulfilment actions */}
            {selected.actions?.admin?.ship && (
              <div className="rounded-xl border border-accent-strong/30 bg-accent-strong/5 p-4 space-y-3">
                <h4 className="font-semibold text-ink flex items-center gap-2"><Truck className="w-4 h-4" /> {t('admin.orders.ship_this')}</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select aria-label={t('admin.orders.carrier')} value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} className={select}>
                    {CARRIERS.map((c) => <option key={c} value={c}>{c === 'Other' ? t('admin.orders.other_carrier') : c}</option>)}
                  </select>
                  <input value={ship.tracking_number} onChange={(e) => setShip({ ...ship, tracking_number: e.target.value })} placeholder={t('order_page.tracking_number')} aria-label={t('order_page.tracking_number')} className={select} />
                </div>
                <button disabled={busy} onClick={markShipping} className={primaryButtonInline}>{t('admin.orders.mark_shipping')}</button>
              </div>
            )}

            {selected.actions?.admin?.confirm && (
              <div className="rounded-xl border border-line p-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-ink">{selected.carrier}: <span className="font-mono">{selected.tracking_number}</span></span>
                <button disabled={busy} onClick={confirmReceived} className={primaryButtonInline}>
                  <PackageCheck className="w-4 h-4" /> {t('admin.orders.confirm_received')}
                </button>
              </div>
            )}

            {selected.actions?.admin?.cancel && (
              !cancelling ? (
                <button ref={cancelOpenRef} type="button" onClick={() => setCancelling(true)} className={dangerLink}>
                  <XCircle className="w-4 h-4" /> {t('admin.orders.cancel_order')}
                </button>
              ) : (
                <div className="space-y-3 border-t border-line pt-4">
                  <label htmlFor="cancel-reason" className="block font-semibold text-ink">{t('admin.orders.cancel_reason_label')}</label>
                  <textarea
                    id="cancel-reason"
                    ref={reasonRef}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    maxLength={500}
                    className="w-full border border-line rounded-xl px-3 py-2 min-h-[70px] bg-paper"
                  />
                  {selected.actions.admin.refund_on_cancel && (
                    <p className="text-muted">{t('admin.orders.refund_note', { amount: baht(selected.total) })}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setCancelling(false)} className={secondaryButton}>{t('admin.orders.keep')}</button>
                    <button
                      disabled={busy || !cancelReason.trim()}
                      onClick={cancelOrder}
                      type="button"
                      className={dangerButton}
                    >
                      {selected.actions.admin.refund_on_cancel ? <RotateCcw className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {selected.actions.admin.refund_on_cancel ? t('admin.orders.refund_cancel', { amount: baht(selected.total) }) : t('admin.orders.cancel_tell')}
                    </button>
                  </div>
                </div>
              )
            )}

            <div className="space-y-2">
              <label htmlFor="admin-note" className="block font-semibold text-ink">{t('admin.orders.internal_note')}</label>
              <textarea id="admin-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className="w-full border border-line rounded-xl px-3 py-2 min-h-[70px] bg-paper" />
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => saveNote(false)} className={secondaryButton}>{t('admin.orders.save_note')}</button>
                {selected.needs_attention && (
                  <button disabled={busy} onClick={() => saveNote(true)} className={secondaryButton}>{t('admin.orders.mark_resolved')}</button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminOrders;
