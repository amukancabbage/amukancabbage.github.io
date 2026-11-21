import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../../auth';
import AsyncState from '../../components/AsyncState';
import { useUnsavedDraft } from '../../components/DraftGuard';
import { errorText, rpc, toHakiError } from '../../haki/api';
import { MAX_ALIASES } from '../../haki/constants';
import { supabase } from '../../lib/supabase';
import { useRemoteData } from '../../lib/useRemoteData';

// Variasi penulisan nama membantu pencocokan pencipta.
export default function HakiProfilePage() {
  const profile = useProfile();
  const remote = useRemoteData(async () => {
    const { data, error } = await supabase.from('hki_aliases').select('alias').order('id');
    if (error) throw toHakiError(error);
    return (data ?? []).map((row) => row.alias as string);
  });
  const [aliases, setAliases] = useState<string[]>([]);
  const baseline = useRef<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dirty = JSON.stringify(aliases) !== JSON.stringify(baseline.current);

  useEffect(() => {
    if (!remote.data) return;
    baseline.current = remote.data;
    setAliases(remote.data);
  }, [remote.data]);
  useUnsavedDraft({ dirty, saving: busy, save: busy ? undefined : save, discard: () => setAliases(baseline.current) });

  async function save() {
    if (busy || !remote.data) return false;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await rpc('hki_put_aliases', { p_aliases: aliases.filter((alias) => alias.trim()) });
      baseline.current = aliases;
      remote.retry();
      setMessage('Alias tersimpan.');
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>Alias Nama</h1>
      <p className="muted">Tambahkan hingga {MAX_ALIASES} variasi nama <strong>{profile.dosen?.nama ?? 'Anda'}</strong> yang muncul pada sertifikat.</p>
      <AsyncState loading={remote.loading} error={remote.error} onRetry={remote.retry} />
      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {remote.data && (
        <section className="card pad stack">
          {!aliases.length && <p className="muted">Belum ada alias.</p>}
          {aliases.map((alias, index) => (
            <div className="row-item" key={index}>
              <label className="field alias-field">
                <span>Alias {index + 1}</span>
                <input value={alias} disabled={busy} onChange={(event) => setAliases((items) => items.map((item, position) => position === index ? event.target.value : item))} />
              </label>
              <button type="button" className="danger" disabled={busy} aria-label={'Hapus alias ' + (index + 1)} onClick={() => setAliases((items) => items.filter((_, position) => position !== index))}>Hapus</button>
            </div>
          ))}
          <div className="form-actions wrap">
            <button className="secondary" disabled={busy || aliases.length >= MAX_ALIASES} onClick={() => setAliases((items) => [...items, ''])}>Tambah alias</button>
            <button disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </section>
      )}
    </div>
  );
}
