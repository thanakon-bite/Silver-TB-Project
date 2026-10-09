import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Copy, Search, Truck, PackageCheck, XCircle, RotateCcw } from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../../lib/api';
import { baht, dateTime, formatAddressLines, ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, PAYMENT_STATUS_STYLE } from '../../lib/format';
import type { Order, OrderStatus, PaymentStatus } from '../../lib/types';
import Modal from '../common/Modal';

const CARRIERS = ['Thailand Post (EMS)', 'Kerry Express', 'Flash Express', 'J&T Express', 'Lalamove', 'Other'];

interface Props {
  initialFilter?: string;
  initialOrderId?: string | null;
}

const AdminOrders: React.FC<Props> = ({ initialFilter, initialOrderId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | ''>(initialFilter === 'paid' ? 'paid' : '');
  const [payment, setPayment] = useState<PaymentStatus | ''>('');
  const [attention, setAttention] = useState(initialFilter === 'attention');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [ship, setShip] = useState({ carrier: CARRIERS[0], tracking_number: '' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const limit = 20;

  const fetchOrders = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) q.set('status', status);
    if (payment) q.set('payment_status', payment);
    if (attention) q.set('needs_attention', 'true');
    if (search) q.set('search', search);
    try {
      const data = await api.get<{ orders: Order[]; total: number }>(`/orders/admin/all?${q}`);
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  }, [page, status, payment, attention, search]);

  useEffect(() => {
    const t = setTimeout(fetchOrders, 250);
    return () => clearTimeout(t);
  }, [fetchOrders]);

  const openOrder = useCallback(async (id: string) => {
    try {
      const o = await api.get<Order>(`/orders/${id}`);
      setSelected(o);
      setNote(o.admin_note || '');
      setShip({ carrier: o.carrier || CARRIERS[0], tracking_number: o.tracking_number || '' });
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  }, []);

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
      Swal.fire('Error', err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const markShipped = () => {
    if (!selected) return;
    if (!ship.tracking_number.trim()) return Swal.fire('Tracking number required', '', 'warning');
    run(() => api.patch<Order>(`/orders/${selected.id}/status`, { status: 'shipped', ...ship }), 'Marked as shipped');
  };

  const markDelivered = () => selected && run(() => api.patch<Order>(`/orders/${selected.id}/status`, { status: 'delivered' }), 'Marked as delivered');

  const cancelUnpaid = async () => {
    if (!selected) return;
    const r = await Swal.fire({ icon: 'warning', title: 'Cancel this unpaid order?', text: 'Reserved stock will be released.', showCancelButton: true, confirmButtonColor: '#FF922B' });
    if (r.isConfirmed) run(() => api.patch<Order>(`/orders/${selected.id}/status`, { status: 'cancelled', reason: 'admin_cancelled' }), 'Order cancelled');
  };

  const refund = async () => {
    if (!selected) return;
    const r = await Swal.fire({
      icon: 'warning',
      title: `Refund ${baht(selected.total)}?`,
      html: 'This issues a <b>full refund through Stripe</b> and cancels the order.',
      input: 'checkbox',
      inputValue: 1,
      inputPlaceholder: 'Put the items back in stock',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Refund',
    });
    if (r.isConfirmed) {
      run(() => api.post<Order>(`/orders/${selected.id}/refund`, { restock: Boolean(r.value) }), 'Refunded');
    }
  };

  const saveNote = (resolve?: boolean) =>
    selected &&
    run(
      () => api.patch<Order>(`/orders/${selected.id}/admin`, { admin_note: note, ...(resolve ? { needs_attention: false } : {}) }),
      resolve ? 'Marked as resolved' : 'Note saved'
    );

  const copyAddress = () => {
    if (!selected) return;
    navigator.clipboard?.writeText(formatAddressLines(selected.shipping_address).join('\n'));
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Address copied', timer: 1000, showConfirmButton: false });
  };

  const select = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-orange/50';
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Order number" className={`${select} pl-9`} />
        </div>
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as OrderStatus | ''); }} className={select}>
          <option value="">All statuses</option>
          {(['pending', 'paid', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select value={payment} onChange={(e) => { setPage(1); setPayment(e.target.value as PaymentStatus | ''); }} className={select}>
          <option value="">All payments</option>
          {(['unpaid', 'paid', 'failed', 'refunded'] as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" className="accent-orange" checked={attention} onChange={(e) => { setPage(1); setAttention(e.target.checked); }} />
          Needs attention
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-gray-100 bg-gray-50/50 text-gray-600">
              <th className="p-3 font-semibold">Order</th>
              <th className="p-3 font-semibold">Customer</th>
              <th className="p-3 font-semibold text-right">Total</th>
              <th className="p-3 font-semibold">Payment</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} onClick={() => openOrder(o.id)} className="border-b border-gray-100 hover:bg-orange/5 cursor-pointer">
                <td className="p-3">
                  <div className="font-mono font-semibold text-gray-800 flex items-center gap-1.5">
                    {o.needs_attention && <AlertTriangle className="w-4 h-4 text-red-500" aria-label="Needs attention" />}
                    {o.order_number}
                  </div>
                  <div className="text-xs text-gray-400">{dateTime(o.created_at)}</div>
                </td>
                <td className="p-3 text-gray-700">{o.profiles?.full_name || '—'}</td>
                <td className="p-3 text-right font-semibold text-gray-900">{baht(o.total)}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs rounded-full font-semibold ${PAYMENT_STATUS_STYLE[o.payment_status]}`}>{o.payment_status}</span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs rounded-full font-semibold ${ORDER_STATUS_STYLE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-end items-center gap-3 mt-4 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded border disabled:opacity-40">Prev</button>
          <span className="text-gray-500">Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded border disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? `Order ${selected.order_number}` : ''} maxWidth="3xl">
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className={`px-2 py-1 rounded-full font-semibold ${ORDER_STATUS_STYLE[selected.status]}`}>{ORDER_STATUS_LABEL[selected.status]}</span>
              <span className={`px-2 py-1 rounded-full font-semibold ${PAYMENT_STATUS_STYLE[selected.payment_status]}`}>Payment: {selected.payment_status}</span>
            </div>

            {selected.needs_attention && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="whitespace-pre-line">{selected.admin_note || 'This order needs a manual check.'}</div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-gray-900">Ship to</h4>
                  <button onClick={copyAddress} className="flex items-center gap-1 text-xs text-orange"><Copy className="w-3 h-3" /> Copy</button>
                </div>
                {formatAddressLines(selected.shipping_address).map((l, i) => <div key={i} className="text-gray-700">{l}</div>)}
              </div>
              <div className="rounded-xl border border-gray-100 p-4 space-y-1 text-gray-700">
                <h4 className="font-semibold text-gray-900 mb-2">Customer & payment</h4>
                <div>{selected.profiles?.full_name} · {selected.profiles?.email}</div>
                <div>Placed: {dateTime(selected.created_at)}</div>
                <div>Paid: {dateTime(selected.paid_at)}</div>
                {selected.stripe_payment_intent_id && <div className="font-mono text-xs text-gray-500 break-all">{selected.stripe_payment_intent_id}</div>}
                <div>LINE alert: {selected.admin_notified_at ? dateTime(selected.admin_notified_at) : '—'}</div>
                {selected.cancel_reason && <div>Cancel reason: {selected.cancel_reason}</div>}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-4">
              {selected.order_items.map((i) => (
                <div key={i.id} className="flex justify-between py-1 text-gray-700">
                  <span>{i.quantity}× {i.product_name}</span>
                  <span>{baht(i.line_total)}</span>
                </div>
              ))}
              {Number(selected.shipping_fee) > 0 && (
                <div className="flex justify-between py-1 text-gray-700"><span>Shipping</span><span>{baht(selected.shipping_fee)}</span></div>
              )}
              <div className="flex justify-between font-bold border-t mt-2 pt-2"><span>Total</span><span>{baht(selected.total)}</span></div>
            </div>

            {/* Fulfilment actions */}
            {selected.status === 'paid' && selected.payment_status === 'paid' && (
              <div className="rounded-xl border border-orange/30 bg-orange/5 p-4 space-y-3">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2"><Truck className="w-4 h-4" /> Ship this order</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} className={select}>
                    {CARRIERS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <input value={ship.tracking_number} onChange={(e) => setShip({ ...ship, tracking_number: e.target.value })} placeholder="Tracking number" className={select} />
                </div>
                <button disabled={busy} onClick={markShipped} className="px-4 py-2 bg-orange text-white font-semibold rounded-lg disabled:opacity-50">Mark as shipped</button>
              </div>
            )}

            {selected.status === 'shipped' && (
              <div className="rounded-xl border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-gray-700">{selected.carrier}: <span className="font-mono">{selected.tracking_number}</span></span>
                <button disabled={busy} onClick={markDelivered} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg disabled:opacity-50">
                  <PackageCheck className="w-4 h-4" /> Mark as delivered
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {selected.status === 'pending' && selected.payment_status !== 'paid' && (
                <button disabled={busy} onClick={cancelUnpaid} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:border-red-300 hover:text-red-600">
                  <XCircle className="w-4 h-4" /> Cancel unpaid order
                </button>
              )}
              {selected.payment_status === 'paid' && !['shipped', 'delivered'].includes(selected.status) && (
                <button disabled={busy} onClick={refund} className="flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg text-red-600 hover:bg-red-50">
                  <RotateCcw className="w-4 h-4" /> Refund & cancel
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="block font-semibold text-gray-900">Internal note</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className="w-full border border-gray-200 rounded-lg px-3 py-2 min-h-[70px]" />
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => saveNote(false)} className="px-3 py-1.5 rounded-lg border border-gray-200">Save note</button>
                {selected.needs_attention && (
                  <button disabled={busy} onClick={() => saveNote(true)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white">Mark resolved</button>
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
