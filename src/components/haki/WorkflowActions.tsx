import { useEffect, useEffectEvent, useState } from 'react';
import { HakiError, errorText, rpc, runExtraction } from '../../haki/api';
import { fieldLabel } from '../../haki/constants';
import type { HkiRecord, Problem, RecordMeta } from '../../haki/types';

type Props = {
  record: HkiRecord;
  meta: RecordMeta;
  reviewNotes: Record<string, string>;
  // dipanggil setelah aksi sukses; `decided` = validator baru memutuskan (buka dokumen berikutnya)
  onDone: (opts?: { decided?: boolean; deleted?: boolean }) => void;
};

type Mode = null | 'submit' | 'revision' | 'reject' | 'correction';

export function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export default function WorkflowActions({ record, meta, reviewNotes, onDone }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [statement, setStatement] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const { caps } = meta;

  async function run(fn: () => Promise<unknown>, opts?: { decided?: boolean; deleted?: boolean }) {
    setBusy(true);
    setError(null);
    setProblems([]);
    try {
      await fn();
      setMode(null);
      setNote('');
      setStatement(false);
      onDone(opts);
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
      const r = await rpc<{ duplicates_total: number }>('hki_submit', {
        p_record: record.id,
        p_versi: record.versi,
        p_pernyataan: statement,
      });
      if (r.duplicates_total > 0) setInfo(`Terkirim. Ada ${r.duplicates_total} kemungkinan duplikat yang akan diperiksa validator.`);
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
    if (!caps.review || mode !== null || busy || isTyping(e)) return;
    if (e.key === 'a' && confirm('Setujui dan arsipkan dokumen ini?')) review('approve');
    if (e.key === 'r') setMode('revision');
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const nothing = !caps.submit && !caps.review && !caps.correction && !caps.delete && !caps.extract;
  if (nothing && !info) return null;

  return (
    <div className="card workflow">
      <div className="card-head">
        <h2>Tindakan</h2>
      </div>
      <div className="pad">
        {info && <p className="notice">{info}</p>}
        {error && <p className="error">{error}</p>}
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

        {mode === null && (
          <div className="form-actions wrap">
            {caps.submit && (
              <button onClick={() => setMode('submit')} disabled={busy}>
                Ajukan ke validator
              </button>
            )}
            {caps.review && (
              <>
                <button onClick={() => review('approve')} disabled={busy} title="Pintasan: A">
                  Setujui &amp; arsipkan
                </button>
                <button className="secondary" onClick={() => setMode('revision')} disabled={busy} title="Pintasan: R">
                  Minta revisi
                </button>
                <button className="danger" onClick={() => setMode('reject')} disabled={busy}>
                  Tolak
                </button>
              </>
            )}
            {caps.correction && (
              <button className="secondary" onClick={() => setMode('correction')} disabled={busy}>
                Minta koreksi arsip
              </button>
            )}
            {caps.extract && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  const first = record.workflow_status === 'DRAFT';
                  if (
                    !first &&
                    !confirm(
                      `Baca ulang AI akan MENIMPA semua isian, termasuk yang sudah Anda ubah. Sisa kesempatan: ${meta.max_rereads - meta.reread_count}. Lanjutkan?`,
                    )
                  )
                    return;
                  run(() => runExtraction(record.id));
                }}
              >
                {record.workflow_status === 'DRAFT' ? 'Baca dengan AI' : `Baca ulang AI (${meta.reread_count}/${meta.max_rereads})`}
              </button>
            )}
            {caps.delete && (
              <button
                className="danger"
                disabled={busy}
                onClick={() => confirm('Hapus dokumen ini?') && run(() => rpc('hki_delete_record', { p_record: record.id }), { deleted: true })}
              >
                Hapus dokumen
              </button>
            )}
          </div>
        )}

        {mode === 'submit' && (
          <div className="stack">
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
              <button onClick={submit} disabled={busy || !statement}>
                Kirim pengajuan
              </button>
              <button className="secondary" onClick={() => setMode(null)}>
                Batal
              </button>
            </div>
          </div>
        )}

        {(mode === 'revision' || mode === 'reject' || mode === 'correction') && (
          <div className="stack">
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
                <button onClick={() => review('request_revision')} disabled={busy}>
                  Kirim permintaan revisi
                </button>
              )}
              {mode === 'reject' && (
                <button className="danger" onClick={() => review('reject')} disabled={busy || !note.trim()}>
                  Tolak dokumen
                </button>
              )}
              {mode === 'correction' && (
                <button
                  onClick={() => run(() => rpc('hki_request_correction', { p_record: record.id, p_alasan: note }))}
                  disabled={busy || note.trim().length < 3}
                >
                  Kirim permintaan koreksi
                </button>
              )}
              <button className="secondary" onClick={() => setMode(null)}>
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}