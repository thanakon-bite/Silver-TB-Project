import type { OrderStatus, PaymentStatus, ShippingSnapshot } from './types';

export const baht = (n: number | string | null | undefined) =>
  `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

/** Dates as Thai customers read them: Thai months and the Buddhist year, e.g. "10 ต.ค. 2569 14:30". */
export const thaiDateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

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

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Awaiting payment',
  paid: 'Paid · preparing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-700',
};

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  unpaid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-200 text-gray-700',
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
