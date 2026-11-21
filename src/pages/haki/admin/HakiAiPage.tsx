import { useEffect, useRef, useState } from 'react';
import AsyncState from '../../../components/AsyncState';
import { useUnsavedDraft } from '../../../components/DraftGuard';
import { useRemoteData } from '../../../lib/useRemoteData';
import { errorText, loadSettings, rpc, toHakiError } from '../../../haki/api';
import { supabase } from '../../../lib/supabase';

type Stats = {
  month_cost: number;
  budget: number;
  by_model: { model: string | null; tahap: string; jumlah: number; gagal: number; token_in: number; token_out: number; biaya: number }[];
  failures: { kode: string | null; jumlah: number }[];
};

const FIELDS: { key: string; label: string; kind: 'bool' | 'text' | 'number'; help?: string }[] = [
  { key: 'ai.enabled', label: 'Aktifkan pembacaan AI', kind: 'bool', help: 'Butuh secret OPENROUTER_API_KEY di Edge Function haki-extract.' },
  { key: 'ai.model_classify', label: 'Model klasifikasi', kind: 'text' },
  { key: 'ai.model_extract', label: 'Model ekstraksi', kind: 'text' },
  { key: 'ai.model_fallback', label: 'Model cadangan ekstraksi', kind: 'text' },
  { key: 'ai.model_escalate', label: 'Model eskalasi', kind: 'text', help: 'Dipakai bila >30% field inti berkeyakinan < 0,5. Kosongkan untuk mematikan.' },
  { key: 'ai.confidence_high', label: 'Ambang keyakinan tinggi', kind: 'number', help: 'Di bawah ini field wajib dikonfirmasi dosen.' },
  { key: 'ai.confidence_low', label: 'Ambang keyakinan rendah', kind: 'number' },
  { key: 'ai.monthly_budget_usd', label: 'Anggaran bulanan (USD, 0 = tanpa batas)', kind: 'number' },
  { key: 'ai.max_rereads', label: 'Batas baca ulang per dokumen', kind: 'number' },
  { key: 'ai.max_pages', label: 'Halaman dikirim ke model', kind: 'number' },
  { key: 'ai.stale_minutes', label: 'Batas menit status "Dibaca AI" sebelum TIMEOUT', kind: 'number' },
];

export default function HakiAiPage() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const settings = useRemoteData(loadSettings);
  const usage = useRemoteData(() => rpc<Stats>('hki_ai_stats'));
  const baseline = useRef<Record<string, unknown>>({});
  const stats = usage.data;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    baseline.current = settings.data.raw;
    setValues(settings.data.raw);
  }, [settings.data]);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline.current);
  useUnsavedDraft({ dirty, saving: busy, save: busy ? undefined : save, discard: () => setValues(baseline.current) });

  async function save() {
    if (busy || !settings.data) return false;
    setError(null);
    setMessage(null);
    const high = Number(values['ai.confidence_high']);
    const low = Number(values['ai.confidence_low']);
    if (!(low >= 0 && high <= 1 && low < high)) {
      setError('Ambang harus 0 ≤ rendah < tinggi ≤ 1.');
      return false;
    }
    setBusy(true);
    try {
      const rows = FIELDS.map((field) => ({
        key: field.key,
        value: field.kind === 'number' ? Number(values[field.key] ?? 0)
          : field.kind === 'bool' ? values[field.key] === true : String(values[field.key] ?? ''),
      }));
      const { error } = await supabase.from('hki_settings').upsert(rows);
      if (error) throw toHakiError(error);
      baseline.current = values;
      setMessage('Konfigurasi tersimpan.');
      usage.retry();
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
      <h1>Konfigurasi AI</h1>
      <p className="muted">
        Kunci API OpenRouter disimpan sebagai secret Edge Function, tidak pernah di peramban. Admin hanya melihat
        statistik biaya, bukan isi dokumen.
      </p>
      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <AsyncState loading={settings.loading} error={settings.error} onRetry={settings.retry} />
      {settings.data && <div className="card form">
        {FIELDS.map((f) => (
          <label key={f.key} className={f.kind === 'bool' ? 'wide check' : undefined}>
            {f.kind === 'bool' ? (
              <>
                <input type="checkbox" disabled={busy} checked={values[f.key] === true} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))} />
                {f.label}
              </>
            ) : (
              <>
                {f.label}
                <input
                  type={f.kind === 'number' ? 'number' : 'text'}
                  step="any"
                  disabled={busy}
                  value={String(values[f.key] ?? '')}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              </>
            )}
            {f.help && <span className="muted small">{f.help}</span>}
          </label>
        ))}
        <div className="form-actions">
          <button onClick={() => void save()} disabled={busy || !dirty}>
            Simpan
          </button>
        </div>
      </div>}

      <AsyncState loading={usage.loading} error={usage.error} onRetry={usage.retry} />
      {stats && (
        <>
          <h2 className="section-title">Bulan ini</h2>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Biaya</div>
              <div className="stat-value">${Number(stats.month_cost).toFixed(2)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Anggaran</div>
              <div className="stat-value">{Number(stats.budget) > 0 ? `$${Number(stats.budget).toFixed(2)}` : '∞'}</div>
            </div>
          </div>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Tahap</th>
                  <th>Panggilan</th>
                  <th>Gagal</th>
                  <th>Token masuk/keluar</th>
                  <th>Biaya</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_model.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Belum ada panggilan.
                    </td>
                  </tr>
                ) : (
                  stats.by_model.map((m, i) => (
                    <tr key={i}>
                      <td>{m.model ?? '(cache)'}</td>
                      <td>{m.tahap}</td>
                      <td>{m.jumlah}</td>
                      <td>{m.gagal}</td>
                      <td>
                        {m.token_in} / {m.token_out}
                      </td>
                      <td>${Number(m.biaya).toFixed(4)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {stats.failures.length > 0 && (
            <p className="muted">Kegagalan: {stats.failures.map((f) => `${f.kode ?? '?'} (${f.jumlah})`).join(', ')}</p>
          )}
        </>
      )}
    </div>
  );
}
