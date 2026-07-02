import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { storage } from '@/src/utils/storage';
import { api } from '@/src/api/client';

type User = {
  user_id: string; email: string; name: string; role: string; phone?: string;
  language: string; picture?: string; verified: boolean; subscription: string;
  bio?: string; farm_details?: any; crops_grown?: string[];
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  setUserSession: (token: string, user: User) => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.secureGet('cropido_token', '');
        if (token) {
          const { user } = await api.me();
          setUser(user);
        }
      } catch {
        await storage.secureRemove('cropido_token');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setUserSession = async (token: string, u: User) => {
    await storage.secureSet('cropido_token', token);
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    await setUserSession(token, user);
  };
  const register = async (data: any) => {
    const { token, user } = await api.register(data);
    await setUserSession(token, user);
  };
  const logout = async () => {
    try { await api.logout(); } catch {}
    await storage.secureRemove('cropido_token');
    setUser(null);
  };
  const refresh = async () => {
    try { const { user } = await api.me(); setUser(user); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUserSession, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};
