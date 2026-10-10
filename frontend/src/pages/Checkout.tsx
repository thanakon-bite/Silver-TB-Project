import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, CreditCard, Plus, AlertCircle, Clock } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';
import { baht, formatAddressLines, uuidv4 } from '../lib/format';
import type { Address, Order } from '../lib/types';
import AddressForm, { emptyAddress, validateAddress, pruneErrors, toAddressPayload, AddressFormValue } from '../component/address/AddressForm';
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

const summaryBox = 'bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-100 dark:border-gray-700';
const optionClass = (active: boolean) =>
  `flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
    active ? 'border-orange bg-orange/5' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500'
  }`;

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
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const [orderError, setOrderError] = useState('');
  const [reservationExpired, setReservationExpired] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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
    api
      .get<{ shipping_fee: number }>('/orders/shipping-fee')
      .then((r) => setShippingFee(Number(r.shipping_fee)))
      .catch(() => setShippingFee(null));
  }, []);

  // Each step starts at the top of the page, not wherever the previous step was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const cartSignature = useMemo(
    () => JSON.stringify([...items].sort((a, b) => a.product_id.localeCompare(b.product_id)).map((i) => [i.product_id, i.quantity])),
    [items]
  );

  const updateForm = (next: AddressFormValue) => {
    setErrors((e) => pruneErrors(e, form, next));
    setForm(next);
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    let shipping: Record<string, unknown>;
    if (selected === 'new') {
      const errs = validateAddress(form);
      setErrors(errs);
      if (Object.keys(errs).length) {
        // Bring the first invalid field into view once the messages have rendered.
        requestAnimationFrame(() =>
          formRef.current?.querySelector('[role="alert"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        );
        return;
      }
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
    setOrderError('');
    setReservationExpired(false);
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
      setOrderError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExpired = () => {
    resetRequestId();
    setOrder(null);
    setStep(1);
    setReservationExpired(true);
  };

  if (!user || (items.length === 0 && !order)) return null;

  const feeLabel = (fee: number | string | null) =>
    fee === null ? '–' : Number(fee) > 0 ? baht(fee) : <span className="text-green-600 dark:text-green-400 font-semibold">{t('checkout_page.free')}</span>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">{t('checkout')}</h1>

      <ol className="flex items-center justify-center mb-10 text-sm sm:text-base">
        <li className={`flex items-center gap-2 text-orange ${step === 1 ? 'font-bold' : ''}`} aria-current={step === 1 ? 'step' : undefined}>
          <MapPin className="w-5 h-5" />
          <span>{t('checkout_page.step_address')}</span>
        </li>
        <li aria-hidden className={`w-10 sm:w-16 h-px mx-3 sm:mx-4 ${step === 2 ? 'bg-orange' : 'bg-gray-300 dark:bg-gray-600'}`} />
        <li
          className={`flex items-center gap-2 ${step === 2 ? 'text-orange font-bold' : 'text-gray-400 dark:text-gray-500'}`}
          aria-current={step === 2 ? 'step' : undefined}
        >
          <CreditCard className="w-5 h-5" />
          <span>{t('checkout_page.step_payment')}</span>
        </li>
      </ol>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">{t('checkout_page.address_title')}</h2>
            {reservationExpired && (
              <div role="status" className="mb-6 flex items-start gap-2 rounded-xl border border-line bg-sunken p-3 text-sm text-ink">
                <Clock className="w-4 h-4 mt-0.5 shrink-0 text-accent-strong" />
                <p>
                  <strong className="font-semibold">{t('checkout_page.expired_title')}</strong> · {t('checkout_page.expired_text')}
                </p>
              </div>
            )}
            <form ref={formRef} onSubmit={placeOrder} noValidate className="space-y-6">
              {addresses === null ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('checkout_page.loading_addresses')}</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((a) => (
                    <label key={a.id} className={optionClass(selected === a.id)}>
                      <input type="radio" name="address" className="mt-1 accent-orange" checked={selected === a.id} onChange={() => setSelected(a.id)} />
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {a.label && <span className="text-xs font-bold uppercase tracking-wide text-orange mr-2">{a.label}</span>}
                        {a.is_default && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                            {t('checkout_page.default_address')}
                          </span>
                        )}
                        {formatAddressLines({ ...a, province_id: a.province_id }).map((l, i) => (
                          <div key={i} className={i === 0 ? 'font-semibold text-gray-900 dark:text-gray-100 mt-1' : ''}>
                            {l}
                          </div>
                        ))}
                      </div>
                    </label>
                  ))}

                  {addresses.length > 0 && (
                    <label className={`${optionClass(selected === 'new')} items-center`}>
                      <input type="radio" name="address" className="accent-orange" checked={selected === 'new'} onChange={() => setSelected('new')} />
                      <Plus className="w-4 h-4 text-orange" />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('checkout_page.new_address')}</span>
                    </label>
                  )}

                  {selected === 'new' && (
                    <div className="pt-2 space-y-4">
                      <AddressForm value={form} onChange={updateForm} errors={errors} />
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <input type="checkbox" className="accent-orange" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                        {t('checkout_page.save_address')}
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className={summaryBox}>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('checkout_page.summary')}</h3>
                <div className="space-y-2 mb-4">
                  {items.map((item) => (
                    <div key={item.product_id} className="flex justify-between gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span>
                        {item.quantity}× {item.name}
                      </span>
                      <span className="shrink-0">{baht(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                    <span>{t('checkout_page.shipping_fee')}</span>
                    <span>{feeLabel(shippingFee)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span>{t('checkout_page.estimated_total')}</span>
                  <span>{baht(totalPrice + (shippingFee || 0))}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('checkout_page.summary_note')}</p>
              </div>

              {orderError && (
                <div role="alert" className="flex items-start gap-2 text-sm text-danger">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>
                    <strong className="font-semibold">{t('checkout_page.place_error')}</strong> · {orderError}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || addresses === null}
                className="w-full py-3.5 bg-orange-gradient text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? t('checkout_page.reserving') : t('checkout_page.continue')}
              </button>
            </form>
          </motion.div>
        )}

        {step === 2 && order && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100">{t('checkout_page.payment_title')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('checkout_page.order_number', { number: order.order_number })}</p>

            <div className={`${summaryBox} mb-6 text-sm`}>
              {order.order_items.map((i) => (
                <div key={i.id} className="flex justify-between gap-4 text-gray-600 dark:text-gray-300 py-0.5">
                  <span>
                    {i.quantity}× {i.product_name}
                  </span>
                  <span className="shrink-0">{baht(i.line_total)}</span>
                </div>
              ))}
              <div className="flex justify-between text-gray-600 dark:text-gray-300 py-0.5">
                <span>{t('checkout_page.shipping_fee')}</span>
                <span>{feeLabel(order.shipping_fee)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                <span>{t('checkout_page.total')}</span>
                <span>{baht(order.total)}</span>
              </div>
              <div className="mt-3 text-gray-500 dark:text-gray-400">
                {formatAddressLines(order.shipping_address).map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>

            <PaymentStep order={order} onExpired={handleExpired} />

            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-6 w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
            >
              {t('checkout_page.change_address')}
            </button>
            <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
              {t('checkout_page.pay_later')}{' '}
              <Link to="/orders" className="underline">
                {t('checkout_page.my_orders')}
              </Link>
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
