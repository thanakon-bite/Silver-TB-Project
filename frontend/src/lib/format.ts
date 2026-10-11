import type { Order, OrderStatus, ShippingSnapshot, ShippingTier } from './types';

export const baht = (n: number | string | null | undefined) =>
  `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

/** Dates as Thai customers read them: Thai months and the Buddhist year, e.g. "10 ต.ค. 2569 14:30". */
export const thaiDateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

/** A date and time in the reader's language: Thai months and Buddhist year in Thai, day-month-year in English. */
export const localDateTime = (iso: string | null | undefined, lang: string | undefined) =>
  !iso ? '-' : (lang || 'th').startsWith('th') ? thaiDateTime(iso) : dateTime(iso);

/** A calendar day in the reader's language, read in Thai time (Promotion dates): "1 พ.ย. 2569" / "1 Nov 2026". */
export const localDate = (iso: string | null | undefined, lang: string | undefined) =>
  !iso ? '-' : new Date(iso).toLocaleDateString((lang || 'th').startsWith('th') ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' });

export function formatAddressLines(a: ShippingSnapshot | string | null | undefined): string[] {
  if (!a) return [];
  if (typeof a === 'string') return [a];
  const bkk = a.province_id === 1 || a.province === 'กรุงเทพมหานคร';
  return [
    `${a.recipient_name} · ${a.phone}`,
    a.address_line,
    `${bkk ? 'แขวง' : 'ต.'}${a.subdistrict} ${bkk ? 'เขต' : 'อ.'}${a.district}`,
    `${bkk ? a.province : `จ.${a.province}`} ${a.postal_code}`,
  ];
}

/** Cancel Reasons the system writes itself are codes; an Admin's own words show as written. */
const SYSTEM_CANCEL_REASONS = ['payment_timeout', 'customer_cancelled', 'replaced_by_new_checkout', 'admin_cancelled', 'refunded_by_admin'];
export const cancelReasonText = (reason: string, t: (key: string) => string) =>
  SYSTEM_CANCEL_REASONS.includes(reason) ? t(`cancel_reasons.${reason}`) : reason;

/** "1 ชิ้น", "2–5 ชิ้น", "6 ชิ้นขึ้นไป": the paid units a Shipping Tier covers. */
export const tierLabel = (tier: ShippingTier, t: (key: string, o?: Record<string, unknown>) => string) =>
  tier.max_units === null
    ? t('shipping_rule.units_open', { count: tier.min_units })
    : tier.max_units === tier.min_units
      ? t('shipping_rule.units_one', { count: tier.min_units })
      : t('shipping_rule.units_range', { min: tier.min_units, max: tier.max_units });

/** The i18n key under `order_status` for an Order as people read it (CONTEXT.md); a refunded cancellation says so. */
export const orderStatusKey = (o: Pick<Order, 'status' | 'refunded_at'>) =>
  o.status === 'cancelled' && o.refunded_at ? 'cancelled_refunded' : o.status;

/** Status chips: one neutral shape; colour only where the status asks the reader to act or reassures them. */
export const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  awaiting_payment: 'border border-accent-strong/40 bg-accent-strong/10 text-accent-strong',
  paid: 'border border-line bg-sunken text-ink',
  waiting_shipping: 'border border-line bg-sunken text-ink',
  shipping: 'border border-line bg-sunken text-ink',
  confirmed: 'border border-success/40 bg-success/10 text-success',
  cancelled: 'border border-line text-muted',
};

/** Read/write localStorage safely (private mode, blocked storage, SSR). */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — keep working in memory */
    }
  },
};

/** RFC 4122 v4 UUID (crypto.randomUUID needs https; fall back to getRandomValues). */
export function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
