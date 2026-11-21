import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile } from '../../auth';
import AsyncState from '../../components/AsyncState';
import { useDraftGuard, useUnsavedDraft } from '../../components/DraftGuard';
import PrivacyGate from '../../components/haki/PrivacyGate';
import { errorText, loadSettings, rpc } from '../../haki/api';
import { MAX_FILES_PER_SESSION } from '../../haki/constants';
import { fmtBytes } from '../../haki/format';
import { descendants } from '../../haki/listQuery';
import { uploadNewRecord } from '../../haki/upload';
import { supabase } from '../../lib/supabase';

type Item = {
  id: string;
  file: File;
  state: 'antre' | 'menyiapkan' | 'mengunggah' | 'selesai' | 'gagal';
  message?: string;
  recordId?: string;
  duplicate?: boolean;
};
type DosenOption = { id: number; nama: string };

const labels: Record<Item['state'], string> = {
  antre: 'Siap diunggah',
  menyiapkan: 'Menyiapkan',
  mengunggah: 'Mengunggah',
  selesai: 'Tersimpan',
  gagal: 'Gagal',
};

export default function HakiUploadPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const { requestLeave } = useDraftGuard();
  const isOperator = profile.role === 'operator';
  const [items, setItems] = useState<Item[]>([]);
  const [dosen, setDosen] = useState<DosenOption[]>([]);
  const [onBehalf, setOnBehalf] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [maxPages, setMaxPages] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [newRecord, setNewRecord] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const pending = items.some((item) => item.state === 'antre' || item.state === 'gagal');

  useUnsavedDraft({ dirty: pending, saving: busy, discard: () => setItems([]) });
  useEffect(() => { if (newRecord && !busy) navigate('/haki/dokumen/' + newRecord); }, [newRecord, busy, navigate]);

  useEffect(() => {
    if (!profile.privacy_notice_accepted_at) return;
    let alive = true;
    setLoadError('');
    setMaxPages(null);
    async function load() {
      const settings = await loadSettings();
      if (isOperator && profile.unit_id != null) {
        // Dosen dalam cakupan unit operator. RPC memvalidasi ulang pemilik.
        const [units, lecturers] = await Promise.all([
          supabase.from('units').select('id, parent_id'),
          supabase.from('dosen').select('id, nama, unit_id').order('nama'),
        ]);
        if (units.error || lecturers.error) throw new Error('Daftar dosen gagal dimuat.');
        const scope = new Set(descendants(units.data ?? [], profile.unit_id));
        if (alive) setDosen((lecturers.data ?? []).filter((row) => row.unit_id != null && scope.has(row.unit_id)));
      }
      if (alive) setMaxPages(settings.maxPages);
    }
    void load().catch(() => { if (alive) setLoadError('Persiapan unggah gagal dimuat.'); });
    return () => { alive = false; };
  }, [profile.privacy_notice_accepted_at, isOperator, profile.unit_id, reload]);

  const canPick = !busy && maxPages != null && (!isOperator || !!onBehalf);
  function addFiles(list: FileList | null) {
    if (!list?.length || !canPick) return;
    const remaining = MAX_FILES_PER_SESSION - items.length;
    setError(list.length > remaining ? 'Maksimal ' + MAX_FILES_PER_SESSION + ' berkas per sesi unggah.' : '');
    const incoming = Array.from(list).slice(0, remaining).map((file) => ({ id: crypto.randomUUID(), file, state: 'antre' as const }));
    setItems((current) => [...current, ...incoming].slice(0, MAX_FILES_PER_SESSION));
  }

  function patch(id: string, value: Partial<Item>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...value } : item));
  }

  async function start() {
    if (!canPick || !pending || maxPages == null) return;
    setBusy(true);
    setError('');
    try {
      const { prepareFile } = await import('../../haki/pdfPrep');
      for (const item of items) {
        if (item.state !== 'antre' && item.state !== 'gagal') continue;
        try {
          patch(item.id, { state: 'menyiapkan', message: undefined });
          const prepared = await prepareFile(item.file, maxPages);
          patch(item.id, { state: 'mengunggah' });
          const result = await uploadNewRecord(prepared, isOperator ? Number(onBehalf) : null);
          patch(item.id, { state: 'selesai', recordId: result.recordId, duplicate: result.duplicate_file });
        } catch (e) {
          patch(item.id, { state: 'gagal', message: errorText(e) });
        }
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function createManual() {
    setBusy(true);
    setError('');
    try {
      setNewRecord(await rpc<string>('hki_create_record', { p_on_behalf: null, p_manual: true }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const step = !profile.privacy_notice_accepted_at ? 0 : items.some((item) => item.state !== 'antre') ? 2 : 1;
  const allFailedOrDone = items.length > 0 && !items.some((item) => item.state === 'antre');

  return (
    <div className="page upload-page">
      <h1>Unggah Sertifikat HKI</h1>
      <ol className="upload-steps" aria-label="Tahap unggah">
        {['Privasi', 'Pilih berkas', 'Hasil unggah'].map((label, index) => (
          <li key={label} aria-current={step === index ? 'step' : undefined}>{index + 1}. {label}</li>
        ))}
      </ol>
      <PrivacyGate>
        <AsyncState loading={maxPages === null} error={loadError} onRetry={() => setReload((n) => n + 1)} />
        {error && <p className="error" role="alert">{error}</p>}

        {isOperator && (
          <div className="card pad">
            <label className="field">
              <span>Atas nama dosen</span>
              <select value={onBehalf} onChange={(event) => setOnBehalf(event.target.value)} disabled={busy || maxPages === null}>
                <option value="">Pilih dosen di unit Anda</option>
                {dosen.map((row) => <option key={row.id} value={row.id}>{row.nama}</option>)}
              </select>
            </label>
            {!dosen.length && maxPages != null && <p className="muted small">Belum ada dosen dalam cakupan unit Anda.</p>}
          </div>
        )}

        <div className="card dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
          <h2>Pilih sertifikat</h2>
          <p>PDF, JPEG, PNG, atau HEIC. Maksimal 20 MB dan 30 halaman per berkas, hingga {MAX_FILES_PER_SESSION} berkas per sesi.</p>
          {isOperator && !onBehalf && <p className="muted small">Pilih dosen pemilik sebelum menambahkan berkas.</p>}
          <div className="form-actions wrap">
            <button type="button" className="secondary" onClick={() => fileInput.current?.click()} disabled={!canPick}>Pilih berkas</button>
            <button type="button" className="secondary" onClick={() => cameraInput.current?.click()} disabled={!canPick}>Foto dengan kamera</button>
          </div>
          <input ref={fileInput} type="file" hidden multiple accept="application/pdf,image/jpeg,image/png,image/heic,.heic" onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
          <input ref={cameraInput} type="file" hidden accept="image/*" capture="environment" onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
        </div>

        {!!items.length && (
          <section className="card pad" aria-labelledby="upload-results">
            <h2 id="upload-results">{step === 2 ? 'Hasil unggah' : 'Berkas dipilih'}</h2>
            <ul className="home-records" aria-live="polite">
              {items.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.file.name}</strong>
                    <div className="muted small">{fmtBytes(item.file.size)}</div>
                    {item.message && <span className="error-inline">{item.message}</span>}
                    {item.duplicate && <div className="muted small">Berkas identik pernah diunggah.</div>}
                  </div>
                  <span className={'badge badge-' + (item.state === 'selesai' ? 'ok' : item.state === 'gagal' ? 'bad' : 'info')}>{labels[item.state]}</span>
                  {item.recordId ? <Link to={'/haki/dokumen/' + item.recordId}>Buka dokumen</Link>
                    : <button type="button" className="danger" disabled={busy} onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>Hapus</button>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="form-actions wrap">
          <button onClick={() => void start()} disabled={!canPick || !pending}>
            {busy ? 'Memproses…' : allFailedOrDone && pending ? 'Coba unggah lagi' : 'Unggah'}
          </button>
          {!isOperator && (
            <button className="secondary" onClick={() => requestLeave(createManual)} disabled={busy}>Buat rekaman manual</button>
          )}
        </div>
      </PrivacyGate>
    </div>
  );
}
