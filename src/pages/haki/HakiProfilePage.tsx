import { useEffect, useState } from 'react';
import { useProfile } from '../../auth';
import { errorText, rpc } from '../../haki/api';
import { MAX_ALIASES } from '../../haki/constants';
import { supabase } from '../../lib/supabase';

// variasi penulisan nama membantu pencocokan pencipta
export default function HakiProfilePage() {
  const profile = useProfile();
  const [aliases, setAliases] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('hki_aliases')
      .select('alias')
      .order('id')
      .then(({ data }) => setAliases((data ?? []).map((a) => a.alias)));
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await rpc('hki_put_aliases', { p_aliases: aliases.filter((a) => a.trim()) });
      setMessage('Alias tersimpan.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>Alias Nama</h1>
      <p className="muted">
        Nama di data dosen: <strong>{profile.dosen?.nama ?? '-'}</strong>. Tambahkan variasi penulisan nama Anda di
        sertifikat (mis. tanpa gelar, singkatan, ejaan lama) agar pencocokan pencipta lebih akurat. Maksimal{' '}
        {MAX_ALIASES} alias.
      </p>
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}
      <div className="card form">
        <div className="row-list wide">
          {aliases.map((a, i) => (
            <div key={i} className="row-item">
              <input value={a} onChange={(e) => setAliases((x) => x.map((v, j) => (j === i ? e.target.value : v)))} />
              <button className="danger" onClick={() => setAliases((x) => x.filter((_, j) => j !== i))}>
                Hapus
              </button>
            </div>
          ))}
          <button className="secondary" disabled={aliases.length >= MAX_ALIASES} onClick={() => setAliases((x) => [...x, ''])}>
            Tambah alias
          </button>
        </div>
        <div className="form-actions">
          <button onClick={save} disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
