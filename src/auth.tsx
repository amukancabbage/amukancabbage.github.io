import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Profile } from './types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  async function loadProfile(id: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, role, dosen_id, unit_id, privacy_notice_accepted_at, dosen(nama), unit:units(nama)')
      .eq('id', id)
      .single();
    setProfile((data as unknown as Profile | null) ?? null);
  }

  // Profil (role & dosen) diambil terpisah dari onAuthStateChange
  // karena memanggil supabase di dalam callback tersebut bisa macet
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setLoading(true);
    loadProfile(userId).then(() => setLoading(false));
  }, [userId]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (userId) await loadProfile(userId);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
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
