/**
 * REST API client for the AnyCompanyRead backend.
 *
 * The API base URL comes from the Vite env var VITE_API_URL (set at build time
 * to the API Gateway URL output by CDK). Falls back to a relative path for local dev.
 */
import type {
  Book,
  CartResponse,
  Order,
  OrderDetail,
  ListBooksResponse,
  AuthTokens,
} from '@anycompanyread/shared';

const API_URL = (import.meta.env.VITE_API_URL as string) || '/api';

const TOKEN_KEY = 'acr_id_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Core fetch wrapper that attaches auth headers and parses JSON/errors. */
async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = token;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  // ----- Auth -----
  signup: (email: string, password: string, name: string) =>
    request<{ message: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // ----- Books -----
  listBooks: (search?: string, genre?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (genre && genre !== 'all') params.set('genre', genre);
    const qs = params.toString();
    return request<ListBooksResponse>(`/books${qs ? `?${qs}` : ''}`);
  },

  getBook: (bookId: string) => request<{ book: Book }>(`/books/${bookId}`),

  // ----- Cart (auth) -----
  getCart: () => request<CartResponse>('/cart', {}, true),

  addToCart: (bookId: string, quantity: number) =>
    request<{ item: unknown }>(
      '/cart',
      { method: 'POST', body: JSON.stringify({ bookId, quantity }) },
      true
    ),

  updateCartItem: (bookId: string, quantity: number) =>
    request<{ item: unknown }>(
      `/cart/${bookId}`,
      { method: 'PUT', body: JSON.stringify({ quantity }) },
      true
    ),

  removeFromCart: (bookId: string) =>
    request<{ message: string }>(`/cart/${bookId}`, { method: 'DELETE' }, true),

  // ----- Orders (auth) -----
  checkout: () => request<{ order: Order }>('/checkout', { method: 'POST' }, true),

  listOrders: () => request<{ orders: Order[] }>('/orders', {}, true),

  getOrder: (orderId: string) =>
    request<OrderDetail>(`/orders/${orderId}`, {}, true),
};
