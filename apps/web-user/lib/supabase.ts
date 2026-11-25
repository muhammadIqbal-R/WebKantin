import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RecoveryClient } from '@kantin/ui';
let client: SupabaseClient | null = null;
export function isCustomerAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'));
}
export function getCustomerAuthClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !key.startsWith('sb_publishable_')) return null;
  client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
export function recoveryAuth(): RecoveryClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith('sb_publishable_')) return null;
  const { auth } = createClient(url, key, { auth:{
    persistSession:false, autoRefreshToken:false, detectSessionInUrl:false, storageKey:'kantin-password-recovery',
  }});
  return {
    async request(email, redirectTo) {
      const { error } = await auth.resetPasswordForEmail(email, { redirectTo });
      if (error && (error.status === 429 || (error.status !== undefined && error.status >= 500))) throw error;
    },
    async verify(token) {
      const { data, error } = await auth.verifyOtp({ token_hash:token, type:'recovery' });
      return !error && Boolean(data.session);
    },
    async update(password) {
      const { error } = await auth.updateUser({ password });
      if (error) return false;
      await auth.signOut({ scope:'local' }).catch(() => undefined);
      return true;
    },
  };
}
