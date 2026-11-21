import { useEffect, useState, type FormEvent } from 'react';
import { Brand } from '../components/Layout';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { document.title = 'Masuk | SISIDOS'; }, []);

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
    <main className="login">
      <div className="login-identity">
        <Brand />
        <p className="login-product">Sistem Informasi Dosen</p>
        <p>Penelitian, pengabdian, artikel mahasiswa, dan kekayaan intelektual.</p>
      </div>
      <div className="login-content">
        <form className="login-card" onSubmit={handleSubmit} aria-busy={loading}>
          <h1>Masuk</h1>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <div className="field">
            <label htmlFor="password">Kata sandi</label>
            <div className="password-control">
              <input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button type="button" className="secondary" aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-controls="password" onClick={() => setVisible((value) => !value)}>
                {visible ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Memproses…' : 'Masuk'}</button>
        </form>
      </div>
    </main>
  );
}
