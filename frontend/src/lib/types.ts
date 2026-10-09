export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

export type ProductCategory = 'beetle' | 'food' | 'log' | 'gear';
export const PRODUCT_CATEGORIES: ProductCategory[] = ['beetle', 'food', 'log', 'gear'];
export const BEETLE_SEXES = ['male', 'female', 'pair', 'trio', 'unsexed'] as const;
export const BEETLE_STAGES = ['egg', 'L1', 'L2', 'L3', 'pupa', 'adult'] as const;

/** Beetle Attributes (CONTEXT.md) — only set on beetle products */
export interface BeetleAttributes {
  family?: string;
  species?: string;
  locality?: string;
  sex?: (typeof BEETLE_SEXES)[number];
  stage?: (typeof BEETLE_STAGES)[number];
  size_mm?: number;
}

export interface Product {
  id: string;
  name: string;
  name_th?: string | null;
  description: string | null;
  description_th?: string | null;
  price: number;
  stock: number;
  category: ProductCategory;
  attributes?: BeetleAttributes;
  images: string[];
  is_best_seller: boolean;
  is_active: boolean;
  views: number;
  created_at?: string;
}

export interface ShippingSnapshot {
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict_id: number;
  subdistrict: string;
  district: string;
  province: string;
  province_id?: number;
  postal_code: string;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  currency: string;
  shipping_address: ShippingSnapshot | string | null;
  order_items: OrderItem[];
  stripe_payment_intent_id: string | null;
  expires_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  // admin-only
  admin_note?: string | null;
  needs_attention?: boolean;
  admin_notified_at?: string | null;
  profiles?: { full_name: string; email: string | null; phone: string | null } | null;
}

export interface Address {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict_id: number;
  subdistrict: string;
  district_id: number;
  district: string;
  province_id: number;
  province: string;
  postal_code: string;
  is_default: boolean;
}

export interface AddressInput {
  label?: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict_id: number | null;
  postal_code: string;
}

export interface GeoOption {
  id: number;
  name_th: string;
  name_en: string;
  postal_code?: string;
}
