import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile } from '../../auth';
import PrivacyGate from '../../components/haki/PrivacyGate';
import { errorText, loadSettings, rpc } from '../../haki/api';
import { MAX_FILES_PER_SESSION } from '../../haki/constants';
import { fmtBytes } from '../../haki/format';
import { uploadNewRecord } from '../../haki/upload';
import { supabase } from '../../lib/supabase';

type Item = {
  key: string;
  file: File;
  state: 'antre' | 'menyiapkan' | 'mengunggah' | 'selesai' | 'gagal';
  message?: string;
  recordId?: string;
  duplicate?: boolean;
};

type DosenOption = { id: number; nama: string };

export default function HakiUploadPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const isOperator = profile.role === 'operator';
  const [items, setItems] = useState<Item[]>([]);
  const [dosen, setDosen] = useState<DosenOption[]>([]);
  const [onBehalf, setOnBehalf] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxPages, setMaxPages] = useState(6);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings().then((s) => setMaxPages(s.maxPages));
    if (!isOperator) return;
    // dosen dalam cakupan unit operator (RPC memvalidasi ulang)
    (async () => {
      const { data: units } = await supabase.from('units').select('id, parent_id');
      const scope = new Set<number>([profile.unit_id!]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const u of units ?? []) {
          if (u.parent_id != null && scope.has(u.parent_id) && !scope.has(u.id)) {
            scope.add(u.id);
            grew = true;
          }
        }
      }
      const { data } = await supabase.from('dosen').select('id, nama, unit_id').order('nama');
      setDosen((data ?? []).filter((d) => d.unit_id != null && scope.has(d.unit_id)));
    })();
  }, [isOperator, profile.unit_id]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const incoming = Array.from(list).map((file) => ({ key: crypto.randomUUID(), file, state: 'antre' as const }));
    setItems((prev) => {
      const next = [...prev, ...incoming];
      if (next.length > MAX_FILES_PER_SESSION) {
        setError(`Maksimal ${MAX_FILES_PER_SESSION} berkas per sesi unggah.`);
        return next.slice(0, MAX_FILES_PER_SESSION);
      }
      return next;
    });
  }

  function patch(key: string, value: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...value } : i)));
  }

  async function start() {
    if (isOperator && !onBehalf) {
      setError('Pilih dosen pemilik dokumen terlebih dahulu.');
      return;
    }
    setBusy(true);
    setError(null);
    const { prepareFile } = await import('../../haki/pdfPrep');
    for (const item of items) {
      if (item.state !== 'antre' && item.state !== 'gagal') continue;
      try {
        patch(item.key, { state: 'menyiapkan', message: undefined });
        const prep = await prepareFile(item.file, maxPages);
        patch(item.key, { state: 'mengunggah' });
        const r = await uploadNewRecord(prep, isOperator ? Number(onBehalf) : null);
        patch(item.key, { state: 'selesai', recordId: r.recordId, duplicate: r.duplicate_file });
      } catch (e) {
        patch(item.key, { state: 'gagal', message: errorText(e) });
      }
    }
    setBusy(false);
  }

  async function createManual() {
    setBusy(true);
    setError(null);
    try {
      const id = await rpc<string>('hki_create_record', { p_on_behalf: null, p_manual: true });
      navigate(`/haki/dokumen/${id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const pending = items.some((i) => i.state === 'antre' || i.state === 'gagal');

  return (
    <div className="page">
      <h1>Unggah Sertifikat HKI</h1>
      <PrivacyGate>
        <p className="muted">
          PDF, JPEG, PNG, atau HEIC; maksimal 20 MB dan 30 halaman per berkas; {MAX_FILES_PER_SESSION} berkas per sesi.
          Setiap berkas menjadi satu dokumen HKI.
        </p>
        {error && <p className="error">{error}</p>}

        <div className="card form">
          {isOperator && (
            <label className="wide">
              Atas nama dosen <em>*</em>
              <select value={onBehalf} onChange={(e) => setOnBehalf(e.target.value)} disabled={busy}>
                <option value="">- pilih dosen di unit Anda -</option>
                {dosen.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="dropzone wide" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
            <p>Seret berkas ke sini, atau</p>
            <div className="form-actions">
              <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
                Pilih berkas
              </button>
              <button type="button" className="secondary" onClick={() => cameraInput.current?.click()} disabled={busy}>
                Foto dengan kamera
              </button>
            </div>
            <input ref={fileInput} type="file" hidden multiple accept="application/pdf,image/jpeg,image/png,image/heic,.heic" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={cameraInput} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>
        </div>

        {items.length > 0 && (
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Berkas</th>
                  <th>Ukuran</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.key}>
                    <td>{i.file.name}</td>
                    <td>{fmtBytes(i.file.size)}</td>
                    <td>
                      {i.state === 'gagal' ? <span className="error-inline">{i.message}</span> : i.state}
                      {i.duplicate && <div className="muted small">Berkas identik pernah diunggah (hanya informasi).</div>}
                    </td>
                    <td className="actions">
                      {i.recordId && <Link to={`/haki/dokumen/${i.recordId}`}>Buka</Link>}
                      {(i.state === 'antre' || i.state === 'gagal') && !busy && (
                        <button className="danger" onClick={() => setItems((p) => p.filter((x) => x.key !== i.key))}>
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions">
          <button onClick={start} disabled={busy || !pending}>
            {busy ? 'Memproses...' : 'Unggah'}
          </button>
          {!isOperator && (
            <button className="secondary" onClick={createManual} disabled={busy}>
              Buat rekaman manual (tanpa berkas)
            </button>
          )}
        </div>
      </PrivacyGate>
    </div>
  );
}
