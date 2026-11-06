import { useEffect, useState } from 'react';
import { errorText, notifyChanged, rpc } from '../../haki/api';
import { JENIS_LABEL, PERAN_LABEL } from '../../haki/constants';
import { fmtDate } from '../../haki/format';
import type { Suggestion } from '../../haki/types';

// kartu konfirmasi: tanpa berkas, alamat, atau daftar pencipta lain
export default function HakiConfirmPage() {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function load() {
    setItems(await rpc<Suggestion[]>('hki_my_suggestions'));
  }

  useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, []);

  async function answer(s: Suggestion, terima: boolean) {
    if (!terima && !confirm(`Anda yakin "${s.nama_tertulis}" bukan Anda? Jawaban ini tersimpan permanen untuk dokumen ini.`)) return;
    setBusy(s.person_id);
    setError(null);
    try {
      await rpc('hki_claim_person', { p_person: s.person_id, p_terima: terima });
      setDone(terima ? 'Terima kasih. Dokumen kini tampil di HKI Saya dan portofolio Anda.' : 'Jawaban tersimpan. Pemilik dokumen sudah diberi tahu.');
      notifyChanged();
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <h1>Konfirmasi Pencipta</h1>
      <p className="muted">
        Nama Anda kemungkinan tercantum pada dokumen HKI berikut. Jawab “Ya, ini saya” agar dokumen masuk ke portofolio
        Anda, atau “Bukan saya” jika keliru.
      </p>
      {done && <p className="notice">{done}</p>}
      {error && <p className="error">{error}</p>}
      {items === null ? (
        <p>Memuat...</p>
      ) : items.length === 0 ? (
        <p className="muted">Tidak ada konfirmasi yang menunggu.</p>
      ) : (
        <div className="confirm-list">
          {items.map((s) => (
            <div key={s.person_id} className="card pad confirm-item">
              <h2>{s.judul || '(tanpa judul)'}</h2>
              <p className="muted">
                {s.jenis ? JENIS_LABEL[s.jenis] : '-'} · Diunggah oleh {s.pengunggah ?? '-'} · {fmtDate(s.created_at)}
              </p>
              <p>
                Tertulis sebagai <strong>{PERAN_LABEL[s.peran]}</strong>: “{s.nama_tertulis}”
              </p>
              <div className="form-actions">
                <button onClick={() => answer(s, true)} disabled={busy === s.person_id}>
                  Ya, ini saya
                </button>
                <button className="danger" onClick={() => answer(s, false)} disabled={busy === s.person_id}>
                  Bukan saya
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
