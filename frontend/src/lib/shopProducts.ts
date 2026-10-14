import { api } from './api';
import type { ShopProduct } from '../component/products/ProductCard';

/** The API serves at most this many products a request. */
const API_PAGE = 100;

/**
 * Every product for sale, fetched a hundred at a time until the server's total is reached. The shop
 * keeps the whole list in memory so search, filters and sort answer at once; only the cards on the
 * page being viewed are drawn (and their photos loaded).
 */
export async function fetchShopProducts(): Promise<ShopProduct[]> {
  const first = await api.get<{ products: ShopProduct[]; total?: number }>(`/products?limit=${API_PAGE}`);
  const all = [...(first.products || [])];
  const total = first.total ?? all.length;
  for (let page = 2; all.length < total && page <= Math.ceil(total / API_PAGE); page++) {
    const next = await api.get<{ products: ShopProduct[] }>(`/products?limit=${API_PAGE}&page=${page}`);
    if (!next.products?.length) break;
    all.push(...next.products);
  }
  return all;
}
