import { supabase } from './supabaseClient';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Numbers for the shop's own wording of `code`, e.g. { count: 3 } products still in a Category. */
  params?: Record<string, number | string>;
  constructor(message: string, status: number, code?: string, params?: Record<string, number | string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

/** The Supabase session token (auto-refreshed by supabase-js) authenticates every API call. */
async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK');
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.code, data?.params);
  if (options.method && options.method !== 'GET' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ApiWrite>(API_WRITE_EVENT, { detail: { path } }));
  }
  return data as T;
}

/**
 * Fired on window after a request that may have changed data succeeded, so views that show what such
 * a change causes (the Notification bell) can refresh at once instead of on their next poll.
 */
export const API_WRITE_EVENT = 'stb:api-write';
export interface ApiWrite {
  path: string;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
