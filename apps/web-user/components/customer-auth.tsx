'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCustomerAuthClient, isCustomerAuthConfigured } from '../lib/supabase';

type AuthState = { epoch: number; user: User | null; loading: boolean; unavailable: boolean; signOut: () => Promise<boolean> };
const Context = createContext<AuthState | null>(null);
export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [loading, setLoading] = useState(isCustomerAuthConfigured);
  const [unavailable, setUnavailable] = useState(() => !isCustomerAuthConfigured());
  useEffect(() => {
    let alive = true;
    const client = getCustomerAuthClient();
    if (!client) return;
    client.auth.getSession().then(({ data, error }) => {
      if (alive) { setUser(data.session?.user ?? null); setUnavailable(!!error); setLoading(false); }
    }).catch(() => { if (alive) { setUnavailable(true); setLoading(false); } });
    const { data } = client.auth.onAuthStateChange((event, session) => { if (alive) { setUser(session?.user ?? null); setLoading(false); if (event === 'SIGNED_OUT') setEpoch(value => value + 1); } });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  async function signOut() {
    const client = getCustomerAuthClient();
    if (!client) return false;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) return false;
      setUser(null);
      return true;
    } catch { return false; }
  }
  return <Context.Provider value={{ epoch, user, loading, unavailable, signOut }}>{children}</Context.Provider>;
}
export function useCustomerAuth() {
  const state = useContext(Context);
  if (!state) throw new Error('Customer auth provider is missing');
  return state;
}
