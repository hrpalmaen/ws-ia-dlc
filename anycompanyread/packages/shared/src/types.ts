/**
 * Shared domain types for AnyCompanyRead.
 * Used by backend Lambda handlers and the React frontend.
 */

/** A book in the catalog (DynamoDB Books table). */
export interface Book {
  bookId: string;
  title: string;
  author: string;
  isbn: string;
  genre: string;
  description: string;
  price: number;
  coverImageUrl: string;
  rating: number;
  pageCount: number;
  publishedYear: number;
  createdAt: string;
}

/**
 * A shopping cart item (DynamoDB Carts table).
 * Book fields are denormalized for quick display without extra lookups.
 */
export interface CartItem {
  userId: string;
  bookId: string;
  quantity: number;
  // Denormalized book fields for display
  title: string;
  author: string;
  price: number;
  coverImageUrl: string;
}

/** Response shape for GET /cart. */
export interface CartResponse {
  items: CartItem[];
  totalPrice: number;
  itemCount: number;
}

export type OrderStatus = 'CONFIRMED' | 'SHIPPED' | 'DELIVERED';

/** An order record (DynamoDB Orders table). */
export interface Order {
  userId: string;
  orderId: string;
  totalPrice: number;
  status: OrderStatus;
  createdAt: string;
  itemCount: number;
}

/** A line item within an order (DynamoDB OrderItems table). */
export interface OrderItem {
  orderId: string;
  bookId: string;
  quantity: number;
  price: number;
  title: string;
  coverImageUrl: string;
}

/** Full order detail (order + its items). */
export interface OrderDetail {
  order: Order;
  items: OrderItem[];
}

// ----- Auth request/response contracts -----

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ConfirmForgotPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

// ----- Cart request contracts -----

export interface AddToCartRequest {
  bookId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

// ----- Books list response -----

export interface ListBooksResponse {
  books: Book[];
  totalCount: number;
}
