import { create } from 'zustand';

import { AppError, isSupabaseConfigured, supabase, toAppError } from '@/lib/supabase';
import type { ProfileRow } from '@/types/database';

type AuthStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unconfigured';

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  profile: ProfileRow | null;
  error: AppError | null;
  init: () => Promise<void>;
  rename: (name: string) => Promise<void>;
}

let initPromise: Promise<void> | null = null;

/**
 * Anonymous sign-in. The session is persisted in AsyncStorage, so the same anonymous user
 * (and their unfinished match) comes back after the app is closed and reopened.
 */
export const useAuth = create<AuthState>((set, get) => ({
  status: 'idle',
  userId: null,
  profile: null,
  error: null,

  init: () => {
    if (!isSupabaseConfigured) {
      set({ status: 'unconfigured', error: new AppError('not_configured') });
      return Promise.resolve();
    }
    if (get().status === 'ready') return Promise.resolve();
    initPromise ??= (async () => {
      set({ status: 'loading', error: null });
      try {
        const { data } = await supabase.auth.getSession();
        let userId = data.session?.user.id ?? null;
        if (!userId) {
          const { data: signIn, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          userId = signIn.user?.id ?? null;
        }
        if (!userId) throw new AppError('not_authenticated');
        const { data: profile, error: profileError } = await supabase.rpc('ensure_profile');
        if (profileError) throw profileError;
        set({ status: 'ready', userId, profile, error: null });
      } catch (e) {
        set({ status: 'error', error: toAppError(e) });
      } finally {
        initPromise = null;
      }
    })();
    return initPromise;
  },

  rename: async (name) => {
    const { data, error } = await supabase.rpc('set_display_name', { p_name: name });
    if (error) throw toAppError(error);
    set({ profile: data });
  },
}));

// Keep the store in sync if the session is dropped (e.g. refresh token revoked).
if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') useAuth.setState({ status: 'idle', userId: null, profile: null });
  });
}
