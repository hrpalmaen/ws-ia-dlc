import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { CartItem } from '@anycompanyread/shared';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';

interface CartContextValue {
  items: CartItem[];
  totalPrice: number;
  itemCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  addToCart: (bookId: string, quantity?: number) => Promise<void>;
  updateQuantity: (bookId: string, quantity: number) => Promise<void>;
  removeItem: (bookId: string) => Promise<void>;
  checkout: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setTotalPrice(0);
      setItemCount(0);
      return;
    }
    setLoading(true);
    try {
      const cart = await api.getCart();
      setItems(cart.items);
      setTotalPrice(cart.totalPrice);
      setItemCount(cart.itemCount);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Load the cart whenever auth state changes.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addToCart = async (bookId: string, quantity = 1) => {
    await api.addToCart(bookId, quantity);
    await refresh();
  };

  const updateQuantity = async (bookId: string, quantity: number) => {
    await api.updateCartItem(bookId, quantity);
    await refresh();
  };

  const removeItem = async (bookId: string) => {
    await api.removeFromCart(bookId);
    await refresh();
  };

  const checkout = async () => {
    await api.checkout();
    await refresh();
  };

  return (
    <CartContext.Provider
      value={{
        items,
        totalPrice,
        itemCount,
        loading,
        refresh,
        addToCart,
        updateQuantity,
        removeItem,
        checkout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
