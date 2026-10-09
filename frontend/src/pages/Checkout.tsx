import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, CreditCard, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';
import { baht, formatAddressLines, uuidv4 } from '../lib/format';
import type { Address, Order } from '../lib/types';
import AddressForm, { emptyAddress, validateAddress, toAddressPayload, AddressFormValue } from '../component/address/AddressForm';
import PaymentStep from '../component/checkout/PaymentStep';

const REQUEST_KEY = 'stb_checkout_request';

/**
 * One idempotency key per (cart contents + address choice). Re-submitting the same checkout
 * (double click, back button, refresh) returns the same order instead of creating a duplicate.
 */
function requestIdFor(signature: string): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(REQUEST_KEY) || 'null');
    if (saved?.signature === signature && saved?.id) return saved.id;
  } catch {
    /* ignore */
  }
  const id = uuidv4();
  try {
    sessionStorage.setItem(REQUEST_KEY, JSON.stringify({ signature, id }));
  } catch {
    /* ignore */
  }
  return id;
}
const resetRequestId = () => {
  try {
    sessionStorage.removeItem(REQUEST_KEY);
  } catch {
    /* ignore */
  }
};

const Checkout = () => {
  const { t } = useTranslation();
  const { items, totalPrice } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [order, setOrder] = useState<Order | null>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [selected, setSelected] = useState<string>('new');
  const [form, setForm] = useState<AddressFormValue>(() => emptyAddress({ recipient_name: user?.full_name || '', phone: user?.phone || '' }));
  const [saveAddress, setSaveAddress] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (items.length === 0 && !order) navigate('/products', { replace: true });
  }, [items.length, order, navigate]);

  useEffect(() => {
    api
      .get<Address[]>('/addresses')
      .then((list) => {
        setAddresses(list);
        if (list.length) setSelected((list.find((a) => a.is_default) || list[0]).id);
      })
      .catch(() => setAddresses([]));
  }, []);

  const cartSignature = useMemo(
    () => JSON.stringify([...items].sort((a, b) => a.product_id.localeCompare(b.product_id)).map((i) => [i.product_id, i.quantity])),
    [items]
  );

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    let shipping: Record<string, unknown>;
    if (selected === 'new') {
      const errs = validateAddress(form);
      setErrors(errs);
      if (Object.keys(errs).length) return;
      shipping = { address: toAddressPayload(form), save_address: saveAddress };
    } else {
      shipping = { address_id: selected };
    }

    const signature = `${cartSignature}|${JSON.stringify(shipping)}`;
    const body = {
      items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      ...shipping,
    };

    setSubmitting(true);
    try {
      let created: Order;
      try {
        created = await api.post<Order>('/orders', { ...body, client_request_id: requestIdFor(signature) });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ORDER_EXPIRED') {
          resetRequestId();
          created = await api.post<Order>('/orders', { ...body, client_request_id: requestIdFor(signature) });
        } else {
          throw err;
        }
      }
      setOrder(created);
      setStep(2);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Could not place order', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExpired = () => {
    resetRequestId();
    setOrder(null);
    setStep(1);
    Swal.fire({ icon: 'info', title: 'Reservation expired', text: 'Your reservation timed out. Please place the order again.' });
  };

  if (!user || (items.length === 0 && !order)) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">{t('checkout')}</h1>

      <div className="flex items-center justify-center mb-10">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-orange font-bold' : 'text-gray-400'}`}>
          <MapPin className="w-5 h-5" />
          <span>{t('shipping')}</span>
        </div>
        <div className="w-16 h-px bg-gray-300 mx-4" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-orange font-bold' : 'text-gray-400'}`}>
          <CreditCard className="w-5 h-5" />
          <span>{t('payment')}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-xl font-bold mb-6 text-gray-800">1. Shipping address</h2>
            <form onSubmit={placeOrder} className="space-y-6">
              {addresses === null ? (
                <p className="text-sm text-gray-500">Loading your addresses…</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        selected === a.id ? 'border-orange bg-orange/5' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input type="radio" name="address" className="mt-1 accent-orange" checked={selected === a.id} onChange={() => setSelected(a.id)} />
                      <div className="text-sm text-gray-700">
                        {a.label && <span className="text-xs font-bold uppercase tracking-wide text-orange mr-2">{a.label}</span>}
                        {a.is_default && <span className="text-xs text-gray-400">Default</span>}
                        {formatAddressLines({ ...a, province_id: a.province_id }).map((l, i) => (
                          <div key={i} className={i === 0 ? 'font-semibold text-gray-900' : ''}>{l}</div>
                        ))}
                      </div>
                    </label>
                  ))}

                  {addresses.length > 0 && (
                    <label
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${
                        selected === 'new' ? 'border-orange bg-orange/5' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input type="radio" name="address" className="accent-orange" checked={selected === 'new'} onChange={() => setSelected('new')} />
                      <Plus className="w-4 h-4 text-orange" />
                      <span className="text-sm font-semibold text-gray-700">Ship to a new address</span>
                    </label>
                  )}

                  {selected === 'new' && (
                    <div className="pt-2 space-y-4">
                      <AddressForm value={form} onChange={setForm} errors={errors} />
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" className="accent-orange" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                        Save this address to my account
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-2">Order summary</h3>
                <div className="space-y-2 mb-4">
                  {items.map((item) => (
                    <div key={item.product_id} className="flex justify-between text-sm text-gray-600">
                      <span>{item.quantity}× {item.name}</span>
                      <span>{baht(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-lg text-gray-900 border-t pt-2">
                  <span>Estimated total</span>
                  <span>{baht(totalPrice)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Final prices, stock and shipping are confirmed on the next step.</p>
              </div>

              <button
                type="submit"
                disabled={submitting || addresses === null}
                className="w-full py-3.5 bg-orange-gradient text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? 'Reserving your items…' : 'Continue to payment'}
              </button>
            </form>
          </motion.div>
        )}

        {step === 2 && order && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-xl font-bold mb-2 text-gray-800">2. Payment</h2>
            <p className="text-sm text-gray-500 mb-6">Order {order.order_number}</p>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 text-sm">
              {order.order_items.map((i) => (
                <div key={i.id} className="flex justify-between text-gray-600 py-0.5">
                  <span>{i.quantity}× {i.product_name}</span>
                  <span>{baht(i.line_total)}</span>
                </div>
              ))}
              {Number(order.shipping_fee) > 0 && (
                <div className="flex justify-between text-gray-600 py-0.5">
                  <span>Shipping</span>
                  <span>{baht(order.shipping_fee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 border-t mt-2 pt-2">
                <span>Total</span>
                <span>{baht(order.total)}</span>
              </div>
              <div className="mt-3 text-gray-500">
                {formatAddressLines(order.shipping_address).map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>

            <PaymentStep order={order} onSubmitted={() => navigate(`/orders/${order.id}?paid=1`)} onExpired={handleExpired} />

            <button onClick={() => setStep(1)} className="mt-6 w-full text-sm text-gray-500 hover:text-gray-700 font-medium">
              ← Change shipping address
            </button>
            <p className="mt-2 text-center text-xs text-gray-400">
              You can also finish paying later from <Link to="/orders" className="underline">My orders</Link>.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
