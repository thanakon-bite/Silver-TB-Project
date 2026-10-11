import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, CreditCard, Plus, AlertCircle, Clock } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';
import { errorMessage } from '../lib/errorMessage';
import { formatAddressLines, uuidv4 } from '../lib/format';
import type { Address, Order } from '../lib/types';
import { pricingBody, usePricedCart } from '../lib/usePricedCart';
import { readGiftChoices } from '../lib/giftChoices';
import { usePromotionChoice } from '../lib/promotionChoice';
import AddressForm, { emptyAddress, validateAddress, pruneErrors, toAddressPayload, AddressFormValue } from '../component/address/AddressForm';
import PaymentStep from '../component/checkout/PaymentStep';
import { CheckoutHeader, CheckoutFooter } from '../component/checkout/FocusedChrome';
import OrderSummary from '../component/checkout/OrderSummary';
import { useProductText } from '../component/products/ProductCard';
import { primaryButton } from '../component/ui/buttonStyles';

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

const optionClass = (active: boolean) =>
  `flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
    active ? 'border-accent-strong bg-accent/5' : 'border-line hover:border-muted'
  }`;

const Checkout = () => {
  const { t, i18n } = useTranslation();
  const text = useProductText();
  const { items, totalPrice, clearCart, restoreCart } = useCart();
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
  const [orderError, setOrderError] = useState('');
  const [reservationExpired, setReservationExpired] = useState(false);
  // The Cart as it was when the Order was created: the Cart empties then (CONTEXT.md: Cart), and comes back if the Order expires here.
  const [orderedItems, setOrderedItems] = useState<typeof items>([]);
  const formRef = useRef<HTMLFormElement>(null);

  // The Cart belongs to the signed-in Customer, so it is only known to be empty once they are.
  useEffect(() => {
    if (user && items.length === 0 && !order) navigate('/', { replace: true });
  }, [user, items.length, order, navigate]);

  useEffect(() => {
    api
      .get<Address[]>('/addresses')
      .then((list) => {
        setAddresses(list);
        if (list.length) setSelected((list.find((a) => a.is_default) || list[0]).id);
      })
      .catch(() => setAddresses([]));
  }, []);

  // Each step starts at the top of the page, not wherever the previous step was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const cartSignature = useMemo(
    () => JSON.stringify([...items].sort((a, b) => a.product_id.localeCompare(b.product_id)).map((i) => [i.product_id, i.quantity])),
    [items]
  );

  // Before the order exists, the server prices the Cart (Shipping Rule, Promotions, the Gifts and the Order's
  // Promotion picked in the Cart) so the summary matches what will be charged.
  const [giftChoices] = useState(readGiftChoices);
  // Follows the signed-in Customer: their account is known only once auth has loaded
  const { choice: promotionChoice } = usePromotionChoice();
  const priced = usePricedCart(items, true, giftChoices, promotionChoice);

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
    const body = { ...pricingBody(items, giftChoices, promotionChoice), ...shipping };

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
      setOrderedItems(items);
      setOrder(created);
      setStep(2);
      clearCart();
    } catch (err: any) {
      setOrderError(errorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExpired = () => {
    resetRequestId();
    if (orderedItems.length) restoreCart(orderedItems);
    setOrder(null);
    setStep(1);
    setReservationExpired(true);
  };

  if (!user || (items.length === 0 && !order)) return null;

  // Order items keep the picture they had at checkout; fall back to the Cart's for older orders.
  const imageOf = (productId: string | null) => [...items, ...orderedItems].find((i) => i.product_id === productId)?.image;
  const summary =
    step === 2 && order ? (
      <OrderSummary
        lines={order.order_items.map((i) => ({
          key: i.id,
          name: i.is_gift ? `${i.product_name} (${t('promotions.gift_label')})` : i.product_name,
          quantity: i.quantity,
          amount: i.line_total,
          image: i.product_image || imageOf(i.product_id),
          free: !!i.is_gift,
        }))}
        shippingFee={order.shipping_fee}
        discount={order.discount_total}
        total={order.total}
        totalLabel={t('checkout_page.total')}
      />
    ) : (
      <OrderSummary
        lines={[
          ...items.map((i) => ({ key: i.product_id, name: text.name(i), quantity: i.quantity, amount: i.price * i.quantity, image: i.image })),
          ...(priced?.gifts || [])
            .filter((g) => g.quantity > 0)
            .map((g) => ({
              key: `gift-${g.promotion_id}`,
              name: `${(i18n.language || 'th').startsWith('th') ? g.name_th_product || g.name : g.name} (${t('promotions.gift_label')})`,
              quantity: g.quantity,
              amount: 0,
              free: true,
            })),
        ]}
        shippingFee={priced ? priced.shipping_fee : null}
        discount={priced?.discount_total}
        total={priced ? priced.total : totalPrice}
        totalLabel={t('checkout_page.estimated_total')}
        note={t('checkout_page.summary_note')}
      />
    );

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <CheckoutHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <h1 className="font-display text-3xl font-bold text-ink">{t('checkout')}</h1>
          <ol className="flex items-center gap-3 text-sm">
            <li
              className={`flex items-center gap-1.5 ${step === 1 ? 'font-semibold text-accent-strong' : 'text-muted'}`}
              aria-current={step === 1 ? 'step' : undefined}
            >
              <MapPin className="h-4 w-4" aria-hidden />
              {t('checkout_page.step_address')}
            </li>
            <li aria-hidden className="h-px w-6 bg-line" />
            <li
              className={`flex items-center gap-1.5 ${step === 2 ? 'font-semibold text-accent-strong' : 'text-muted'}`}
              aria-current={step === 2 ? 'step' : undefined}
            >
              <CreditCard className="h-4 w-4" aria-hidden />
              {t('checkout_page.step_payment')}
            </li>
          </ol>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="lg:order-2">{summary}</div>

          <div className="min-w-0 lg:order-1">
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="mb-6 font-display text-xl font-bold text-ink">{t('checkout_page.address_title')}</h2>
                {reservationExpired && (
                  <div role="status" className="mb-6 flex items-start gap-2 rounded-xl border border-line bg-sunken p-3 text-sm text-ink">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                    <p>
                      <strong className="font-semibold">{t('checkout_page.expired_title')}</strong> · {t('checkout_page.expired_text')}
                    </p>
                  </div>
                )}
                <form ref={formRef} onSubmit={placeOrder} noValidate className="space-y-6">
                  {addresses === null ? (
                    <p className="text-sm text-muted">{t('checkout_page.loading_addresses')}</p>
                  ) : (
                    <div className="space-y-3">
                      {addresses.map((a) => (
                        <label key={a.id} className={optionClass(selected === a.id)}>
                          <input type="radio" name="address" className="mt-1 accent-accent-strong" checked={selected === a.id} onChange={() => setSelected(a.id)} />
                          <div className="text-sm text-muted">
                            {a.label && <span className="mr-2 text-xs font-semibold text-accent-strong">{a.label}</span>}
                            {a.is_default && (
                              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t('checkout_page.default_address')}</span>
                            )}
                            {formatAddressLines({ ...a, province_id: a.province_id }).map((l, i) => (
                              <div key={i} className={i === 0 ? 'mt-1 font-semibold text-ink' : ''}>
                                {l}
                              </div>
                            ))}
                          </div>
                        </label>
                      ))}

                      {addresses.length > 0 && (
                        <label className={`${optionClass(selected === 'new')} items-center`}>
                          <input type="radio" name="address" className="accent-accent-strong" checked={selected === 'new'} onChange={() => setSelected('new')} />
                          <Plus className="h-4 w-4 text-accent-strong" aria-hidden />
                          <span className="text-sm font-semibold text-ink">{t('checkout_page.new_address')}</span>
                        </label>
                      )}

                      {selected === 'new' && (
                        <div className="space-y-4 pt-2">
                          <AddressForm value={form} onChange={updateForm} errors={errors} />
                          <label className="flex items-center gap-2 text-sm text-muted">
                            <input type="checkbox" className="accent-accent-strong" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                            {t('checkout_page.save_address')}
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {orderError && (
                    <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <div>
                        <p>
                          <strong className="font-semibold">{t('checkout_page.place_error')}</strong> · {orderError}
                        </p>
                        <p className="mt-1 text-ink">{t('checkout_page.place_error_hint')}</p>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={submitting || addresses === null} className={primaryButton}>
                    {submitting ? t('checkout_page.reserving') : t('checkout_page.continue')}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 2 && order && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="mb-1 font-display text-xl font-bold text-ink">{t('checkout_page.payment_title')}</h2>
                <p className="mb-6 font-mono text-sm text-muted">{t('checkout_page.order_number', { number: order.order_number })}</p>

                <div className="mb-6 border-y border-line py-4 text-sm text-muted">
                  {formatAddressLines(order.shipping_address).map((l, i) => (
                    <div key={i} className={i === 0 ? 'font-semibold text-ink' : ''}>
                      {l}
                    </div>
                  ))}
                  <button type="button" onClick={() => setStep(1)} className="mt-2 whitespace-nowrap font-medium text-accent-strong underline-offset-4 hover:underline">
                    {t('checkout_page.change_address')}
                  </button>
                </div>

                <PaymentStep order={order} onExpired={handleExpired} />

                <p className="mt-4 text-xs text-muted">
                  {t('checkout_page.pay_later')}{' '}
                  <Link to="/orders" className="underline underline-offset-2">
                    {t('checkout_page.my_orders')}
                  </Link>
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </main>
      <CheckoutFooter />
    </div>
  );
};

export default Checkout;
