import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Profile } from './types';

type ProfileResult = { id: string; profile: Profile | null; error: string | null };
type AuthState = {
  session: Session | null;
  profile: Profile | null;
  profileError: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function loadProfile(id: string): Promise<ProfileResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, dosen_id, unit_id, privacy_notice_accepted_at, dosen(nama), unit:units(nama)')
    .eq('id', id)
    .maybeSingle();
  return {
    id,
    profile: (data as unknown as Profile | null) ?? null,
    error: error ? 'Profil gagal dimuat. Periksa koneksi dan coba lagi.' : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Baca profil di luar callback Auth agar permintaan Supabase tidak saling menunggu.
  useEffect(() => {
    if (!userId) { setResult(null); return; }
    let alive = true;
    void loadProfile(userId).then((next) => { if (alive) setResult(next); });
    return () => { alive = false; };
  }, [userId]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function refreshProfile() {
    if (userId) setResult(await loadProfile(userId));
  }

  const current = result?.id === userId ? result : null;
  return (
    <AuthContext.Provider value={{
      session: session ?? null,
      profile: current?.profile ?? null,
      profileError: current?.error ?? null,
      loading: session === undefined || (!!userId && !current),
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}

// Untuk halaman yang hanya tampil setelah login (profile pasti ada)
export function useProfile() {
  const { profile } = useAuth();
  if (!profile) throw new Error('Profil belum dimuat');
  return profile;
}
