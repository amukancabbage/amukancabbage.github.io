import { Check, MessageSquare, ScanText, Send, SquarePen, Trash2, X } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { IconLabel } from '../AppIcon';
import { useUnsavedDraft } from '../DraftGuard';
import { HakiError, errorText, rpc, runExtraction } from '../../haki/api';
import { fieldLabel } from '../../haki/constants';
import type { HkiRecord, Problem, RecordMeta } from '../../haki/types';

type Props = {
  record: HkiRecord;
  meta: RecordMeta;
  reviewNotes: Record<string, string>;
  // dipanggil setelah aksi sukses; `decided` = validator baru memutuskan (buka dokumen berikutnya)
  onDone: (opts?: Completion) => void;
  blockedReason?: string;
  onBusyChange: (busy: boolean) => void;
};

type Completion = { decided?: boolean; deleted?: boolean; version?: number };

type Mode = null | 'submit' | 'revision' | 'reject' | 'correction';

export function isTyping(e: KeyboardEvent) {
  if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export default function WorkflowActions({ record, meta, reviewNotes, blockedReason, onBusyChange, onDone }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [statement, setStatement] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { caps } = meta;
  const disabled = busy || !!blockedReason;
  const firstRead = record.workflow_status === 'DRAFT';
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    if (!completion) return;
    setCompletion(null);
    onDone(completion);
  }, [completion, onDone]);
  useUnsavedDraft({ dirty: statement || note.trim() !== '', saving: busy, discard: reset });

  function reset() {
    setMode(null);
    setNote('');
    setStatement(false);
  }

  async function run(fn: () => Promise<unknown>, opts?: Completion) {
    if (disabled) return;
    setBusy(true);
    setError(null);
    setProblems([]);
    try {
      const result = await fn();
      reset();
      setCompletion({ ...opts, version: typeof result === 'number' ? result : undefined });
    } catch (e) {
      setError(errorText(e));
      if (e instanceof HakiError) setProblems(e.problems);
    } finally {
      setBusy(false);
    }
  }

  const fieldNotes = Object.fromEntries(Object.entries(reviewNotes).filter(([, v]) => v.trim() !== ''));

  async function submit() {
    await run(async () => {
      const r = await rpc<{ duplicates_total: number; versi: number }>('hki_submit', {
        p_record: record.id,
        p_versi: record.versi,
        p_pernyataan: statement,
      });
      if (r.duplicates_total > 0) setInfo(`Terkirim. Ada ${r.duplicates_total} kemungkinan duplikat yang akan diperiksa validator.`);
      return r.versi;
    });
  }

  function review(aksi: 'approve' | 'request_revision' | 'reject') {
    return run(
      () =>
        rpc('hki_review', {
          p_record: record.id,
          p_versi: record.versi,
          p_aksi: aksi,
          p_catatan: note || null,
          p_catatan_field: aksi === 'approve' ? null : Object.keys(fieldNotes).length ? fieldNotes : null,
        }),
      { decided: true },
    );
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (!caps.review || mode !== null || disabled || isTyping(e)
      || !(e.target instanceof HTMLElement && e.target.closest('[data-review-shortcuts]'))) return;
    if (e.key === 'a' && confirm('Setujui dan arsipkan dokumen ini?')) review('approve');
    if (e.key === 'r') setMode('revision');
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const nothing = !caps.submit && !caps.review && !caps.correction && !caps.delete && !caps.extract;
  if (nothing && !info && !blockedReason) return null;

  function extract() {
    if (!firstRead && !confirm(
      `Baca ulang AI menimpa semua isian, termasuk perubahan Anda. Sisa kesempatan ${meta.max_rereads - meta.reread_count}. Lanjutkan?`,
    )) return;
    void run(() => runExtraction(record.id));
  }

  return (
    <section aria-label="Tindakan dokumen" className="workflow" data-review-shortcuts>
      {blockedReason && <p className="notice" role="status">{blockedReason}</p>}
      {info && <p className="notice" role="status">{info}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {problems.length > 0 && (
        <ul className="problems">
          {problems.map((p, i) => (
            <li key={i}>
              {p.field ? <strong>{fieldLabel(p.field)}: </strong> : null}
              {p.message}
            </li>
          ))}
        </ul>
      )}

      {mode === null && !nothing && (
        <div className="form-actions wrap">
          {caps.submit && (
            <button onClick={() => setMode('submit')} disabled={disabled}>
              <IconLabel icon={Send}>Ajukan ke validator</IconLabel>
            </button>
          )}
          {caps.review && (
            <>
              <button onClick={() => review('approve')} disabled={disabled} title="Pintasan: A">
                <IconLabel icon={Check}>Setujui &amp; arsipkan</IconLabel>
              </button>
              <button className="secondary" onClick={() => setMode('revision')} disabled={disabled} title="Pintasan: R">
                <IconLabel icon={MessageSquare}>Minta revisi</IconLabel>
              </button>
            </>
          )}
          {caps.correction && (
            <button onClick={() => setMode('correction')} disabled={disabled}>
              <IconLabel icon={SquarePen}>Minta koreksi arsip</IconLabel>
            </button>
          )}
          {caps.extract && firstRead && <button onClick={extract} disabled={disabled}><IconLabel icon={ScanText}>Baca dengan AI</IconLabel></button>}
          {(caps.review || caps.delete || (caps.extract && !firstRead)) && (
            <details className="actions-disclosure">
              <summary>Tindakan lain</summary>
              <div className="actions">
                {caps.extract && !firstRead && (
                  <button className="secondary" onClick={extract} disabled={disabled}><IconLabel icon={ScanText}>Baca ulang AI ({meta.reread_count}/{meta.max_rereads})</IconLabel></button>
                )}
                {caps.review && <button className="danger" onClick={() => setMode('reject')} disabled={disabled}><IconLabel icon={X}>Tolak</IconLabel></button>}
                {caps.delete && (
                  <button
                    className="danger"
                    disabled={disabled}
                    onClick={() => confirm('Hapus dokumen ini?') && run(() => rpc('hki_delete_record', { p_record: record.id }), { deleted: true })}
                  >
                    <IconLabel icon={Trash2}>Hapus dokumen</IconLabel>
                  </button>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {mode === 'submit' && (
        <div className="card pad stack">
          {meta.problems.length > 0 && (
            <>
              <p>Lengkapi dulu sebelum mengajukan:</p>
              <ul className="problems">
                {meta.problems.map((p, i) => (
                  <li key={i}>
                    {p.field ? <strong>{fieldLabel(p.field)}: </strong> : null}
                    {p.message}
                  </li>
                ))}
              </ul>
            </>
          )}
          <label className="check">
            <input type="checkbox" checked={statement} onChange={(e) => setStatement(e.target.checked)} />
            Saya menyatakan data dan dokumen ini benar serta dapat dipertanggungjawabkan.
          </label>
          <div className="form-actions">
            <button onClick={submit} disabled={disabled || !statement || meta.problems.length > 0}>
              <IconLabel icon={Send}>Kirim pengajuan</IconLabel>
            </button>
            <button className="secondary" onClick={reset} disabled={busy}>
              Batal
            </button>
          </div>
        </div>
      )}

      {(mode === 'revision' || mode === 'reject' || mode === 'correction') && (
        <div className="card pad stack">
          <label className="field">
            {mode === 'reject' ? 'Alasan penolakan (wajib)' : mode === 'correction' ? 'Alasan koreksi (min. 3 karakter)' : 'Catatan umum'}
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          </label>
          {mode === 'revision' && (
            <p className="muted small">
              Catatan per field dapat diisi langsung di bawah setiap field metadata. Isi catatan umum atau minimal satu
              catatan field. ({Object.keys(fieldNotes).length} catatan field terisi)
            </p>
          )}
          <div className="form-actions">
            {mode === 'revision' && (
              <button onClick={() => review('request_revision')} disabled={disabled || (!note.trim() && !Object.keys(fieldNotes).length)}>
                Kirim permintaan revisi
              </button>
            )}
            {mode === 'reject' && (
              <button className="danger" onClick={() => review('reject')} disabled={disabled || !note.trim()}>
                Tolak dokumen
              </button>
            )}
            {mode === 'correction' && (
              <button
                onClick={() => run(() => rpc('hki_request_correction', { p_record: record.id, p_alasan: note }))}
                disabled={disabled || note.trim().length < 3}
              >
                Kirim permintaan koreksi
              </button>
            )}
            <button className="secondary" onClick={reset} disabled={busy}>
              Batal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
