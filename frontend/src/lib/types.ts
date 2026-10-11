export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'waiting_shipping', 'shipping', 'confirmed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** A Category's slug. The Admin keeps the list (lib/catalogue); `beetle` is the one system Category. */
export type ProductCategory = string;
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
  /** Units that can still be ordered: what shoppers see (CONTEXT.md). */
  available: number;
  // admin-only
  on_hand?: number;
  in_transit?: number;
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
  /** Price before a Promotion, and the Promotion that applied (null on older orders). */
  list_price?: number | null;
  discount_per_unit?: number;
  promotion_id?: string | null;
  is_gift?: boolean;
}

/** What the viewer may do with one order, decided by the API (backend lib/orderStatus.js orderActions). */
export interface OrderActions {
  /** The order's owner; null for anyone else. */
  customer: { cancel: boolean; confirm: boolean } | null;
  /** An Admin; null for customers. */
  admin: { ship: boolean; confirm: boolean; cancel: boolean; refund_on_cancel: boolean } | null;
}

/** When an Order's clock runs out: payment for Awaiting Payment, automatic Confirmed for Shipping (admin list only). */
export interface OrderDeadline {
  kind: 'payment' | 'auto_confirm';
  at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  subtotal: number;
  /** Promotion discount already taken off subtotal (CONTEXT.md: Discount). */
  discount_total?: number;
  shipping_fee: number;
  total: number;
  currency: string;
  shipping_address: ShippingSnapshot | string | null;
  order_items: OrderItem[];
  stripe_payment_intent_id: string | null;
  expires_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  confirmed_at: string | null;
  confirmed_by: 'customer' | 'admin' | 'auto' | null;
  refunded_at: string | null;
  payment_failed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  /** Sent with a single order (GET /orders/:id and every order action), not with lists. */
  actions?: OrderActions;
  // admin-only
  admin_note?: string | null;
  needs_attention?: boolean;
  deadline?: OrderDeadline | null;
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

/** One row of the Shipping Rule: paid units from min to max (null = "or more") cost fee baht. */
export interface ShippingTier {
  min_units: number;
  max_units: number | null;
  fee: number;
}

/** CONTEXT.md: Shipping Rule. With no tiers, the flat fallback fee applies. */
export interface ShippingRule {
  tiers: ShippingTier[];
  free_threshold: number | null;
  fallback_fee?: number;
}

/** A Gift a Promotion earned in the Cart (CONTEXT.md: Gift); quantity 0 with out_of_stock when none is Available. */
export interface PricedGift {
  promotion_id: string;
  name_th: string;
  name_en: string | null;
  product_id: string | null;
  name: string | null;
  name_th_product: string | null;
  quantity: number;
  out_of_stock: boolean;
  options: { product_id: string; name: string; name_th: string | null; available: number }[];
}

/** POST /orders/price-preview: what the Cart costs today, priced by the server. */
/** One way a Cart line can take its Promotions: one Exclusive Promotion, or every Stackable one together (ADR 0004). */
export interface LineOption {
  /** 'stack', or the Exclusive Promotion's id: what the Cart sends back as the line's choice. */
  key: string;
  kind: 'exclusive' | 'stack';
  promotions: { id: string; name_th: string; name_en: string | null }[];
  /** What the whole Cart saves with this option (Discounts plus Gifts' worth), the other lines as chosen. */
  saving: number;
}

export interface PricedCart {
  lines: {
    product_id: string;
    name: string;
    quantity: number;
    list_price?: number;
    unit_price: number;
    discount_per_unit: number;
    line_total: number;
    promotion_id: string | null;
    /** Every Promotion this line used: one Exclusive, or the Stackable set. */
    promotion_ids?: string[];
    /** The option the line was priced with: 'none', 'stack' or a Promotion id. */
    option?: string;
    /** The options to choose from, only when there are two or more. */
    options?: LineOption[];
    /** Today's Available for the product (Cart preview only). */
    available?: number;
  }[];
  gifts: PricedGift[];
  next_gifts?: { promotion_id: string; name_th: string; name_en: string | null; units_needed: number; gift_quantity: number }[];
  promotions_applied?: { id: string; name_th: string; name_en: string | null; units: number; discount_total: number }[];
  next_tiers?: {
    promotion_id: string;
    name_th: string;
    name_en: string | null;
    units_needed: number;
    tier: { min_units: number; type: 'percent' | 'baht'; value: number };
  }[];
  limited?: { promotion_id: string; name_th: string; name_en: string | null; reason: 'per_customer' | 'customer_limit' }[];
  paid_units: number;
  items_subtotal: number;
  discount_total: number;
  item_total: number;
  shipping_fee: number;
  total: number;
}
