import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken, setToken, clearToken } from '@/lib/api';

interface AuthUser {
  email: string;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_KEY = 'acr_user';

/** Decode a JWT payload without verifying (client-side display only). */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore a session from a stored token if present and unexpired.
  useEffect(() => {
    const token = getToken();
    if (token) {
      const claims = decodeJwt(token);
      const exp = (claims?.exp as number) || 0;
      if (claims && exp * 1000 > Date.now()) {
        setUser({
          email: (claims.email as string) || '',
          name: claims.name as string | undefined,
        });
      } else {
        clearToken();
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const tokens = await api.login(email, password);
    setToken(tokens.idToken);
    const claims = decodeJwt(tokens.idToken);
    const authUser: AuthUser = {
      email,
      name: claims?.name as string | undefined,
    };
    setUser(authUser);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
  };

  const signup = async (email: string, password: string, name: string) => {
    await api.signup(email, password, name);
    // Auto-login after signup for a smooth demo experience.
    await login(email, password);
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const forgotPassword = async (email: string) => {
    await api.forgotPassword(email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        signup,
        logout,
        forgotPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
