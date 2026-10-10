/**
 * Shared constants: DynamoDB table names (from env), API paths, and catalog genres.
 */

/** DynamoDB table names are injected via Lambda environment variables by CDK. */
export const TABLE_NAMES = {
  BOOKS: process.env.BOOKS_TABLE || 'AnyCompanyRead-Books',
  CARTS: process.env.CARTS_TABLE || 'AnyCompanyRead-Carts',
  ORDERS: process.env.ORDERS_TABLE || 'AnyCompanyRead-Orders',
  ORDER_ITEMS: process.env.ORDER_ITEMS_TABLE || 'AnyCompanyRead-OrderItems',
} as const;

/** REST API paths (used by the frontend API client). */
export const API_PATHS = {
  SIGNUP: '/auth/signup',
  LOGIN: '/auth/login',
  FORGOT_PASSWORD: '/auth/forgot-password',
  CONFIRM_FORGOT_PASSWORD: '/auth/confirm-forgot-password',
  BOOKS: '/books',
  CART: '/cart',
  CHECKOUT: '/checkout',
  ORDERS: '/orders',
} as const;

/** Catalog genres used for the filter dropdown and seed data. */
export const GENRES = [
  'Fiction',
  'Non-Fiction',
  'Science Fiction',
  'Fantasy',
  'Mystery',
  'Biography',
  'History',
  'Self-Help',
  'Technology',
  'Children',
] as const;

export type Genre = (typeof GENRES)[number];
