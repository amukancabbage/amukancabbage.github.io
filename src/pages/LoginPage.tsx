import { CircleHelp, Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import AppIcon from '../components/AppIcon';
import PublicShell from '../components/PublicShell';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.code === 'invalid_credentials'
        ? 'Email atau kata sandi salah.'
        : 'Gagal masuk. Periksa koneksi atau hubungi administrator.');
    } catch {
      setError('Gagal masuk. Periksa koneksi dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell title="Masuk | SISIDOS" action={{ to: '/', label: 'Halaman depan' }}>
      <main className="public-container login-main tw:grid tw:grow tw:justify-items-center">
        <div className="login-layout tw:grid tw:w-full tw:overflow-hidden tw:rounded-panel tw:border tw:border-solid tw:border-line">
          <form className="login-card tw:grid tw:content-center tw:gap-5 tw:bg-surface" onSubmit={handleSubmit} aria-busy={loading}>
            <div className="login-intro">
              <h1>Masuk</h1>
              <p>Gunakan email yang terdaftar di SISIDOS.</p>
            </div>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <div className="field">
              <label htmlFor="password">Kata sandi</label>
              <div className="password-control tw:relative">
                <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button
                  type="button"
                  className="secondary password-toggle tw:grid tw:place-items-center"
                  aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-controls="password"
                  onClick={() => setVisible((value) => !value)}
                >
                  <AppIcon icon={visible ? EyeOff : Eye} size={20} />
                </button>
              </div>
            </div>
            {error && <p className="error login-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'Sedang masuk…' : 'Masuk'}</button>
          </form>
          <aside className="login-aside tw:flex tw:flex-col" aria-labelledby="login-help-title">
            <div className="login-photo" aria-hidden="true" />
            <div className="login-help tw:flex tw:items-start tw:gap-3">
              <AppIcon icon={CircleHelp} size={20} />
              <div>
                <h2 id="login-help-title">Bantuan akun</h2>
                <p>Hubungi administrator institusi untuk meminta akun atau bantuan kata sandi.</p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </PublicShell>
  );
}
