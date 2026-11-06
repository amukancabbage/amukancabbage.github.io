import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { HakiSettings } from '../../haki/api';
import {
  JENIS_LABEL,
  MANUAL_FIELDS,
  STATUS_HKI_LABEL,
  VALIDITY_FIELDS,
  fieldsFor,
  type FieldDef,
} from '../../haki/constants';
import type { FieldValue, HkiRecord, Jenis, MasterItem, Problem } from '../../haki/types';

const AUTOSAVE_MS = 10000;

type Values = Record<string, string>;

function recordValues(r: HkiRecord): Values {
  const out: Values = {};
  for (const f of [...fieldsFor(r.jenis), ...MANUAL_FIELDS, ...VALIDITY_FIELDS]) {
    const v = f.key in r ? (r as unknown as Record<string, unknown>)[f.key] : r.extra?.[f.key];
    out[f.key] = v == null ? '' : String(v);
  }
  out.jenis = r.jenis ?? '';
  return out;
}

export function confidenceLevel(c: number | null | undefined, s: HakiSettings): 'ok' | 'warn' | 'bad' {
  if (c == null || c < s.low) return 'bad';
  return c >= s.high ? 'ok' : 'warn';
}

// perlu konfirmasi: keyakinan null/<high atau nilai AI null, kecuali sudah dikonfirmasi/diubah
export function needsConfirm(fv: FieldValue | undefined, s: HakiSettings): boolean {
  if (!fv || fv.dikonfirmasi || fv.diubah) return false;
  return fv.confidence == null || fv.confidence < s.high || fv.nilai_ai == null;
}

type Props = {
  record: HkiRecord;
  fieldValues: FieldValue[];
  master: MasterItem[];
  settings: HakiSettings;
  editable: boolean;
  problems: Problem[];
  warnings: Problem[];
  revisionNotes: Record<string, string> | null;
  // validator saat memutuskan: catatan per field
  reviewNotes?: Record<string, string> | null;
  onReviewNote?: (field: string, note: string) => void;
  onSave: (fields: Values, confirm: string[]) => Promise<boolean>;
  onJumpPage: (page: number) => void;
};

export default function FieldForm({
  record,
  fieldValues,
  master,
  settings,
  editable,
  problems,
  warnings,
  revisionNotes,
  reviewNotes,
  onReviewNote,
  onSave,
  onJumpPage,
}: Props) {
  const [values, setValues] = useState<Values>(() => recordValues(record));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const versi = useRef(record.versi);

  // muat ulang nilai saat rekaman berganti versi dari luar
  useEffect(() => {
    if (versi.current !== record.versi && dirty.size === 0 && confirmed.size === 0) {
      setValues(recordValues(record));
    }
    versi.current = record.versi;
  }, [record, dirty.size, confirmed.size]);

  const save = useEffectEvent(async () => {
    if (saving || (dirty.size === 0 && confirmed.size === 0)) return;
    setSaving(true);
    const fields = Object.fromEntries([...dirty].map((k) => [k, values[k]]));
    const ok = await onSave(fields, [...confirmed]);
    if (ok) {
      setDirty(new Set());
      setConfirmed(new Set());
      setSavedAt(new Date());
    }
    setSaving(false);
  });

  useEffect(() => {
    if (!editable || (dirty.size === 0 && confirmed.size === 0)) return;
    const t = window.setTimeout(() => save(), AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [editable, dirty, confirmed, values]);

  useEffect(() => {
    if (dirty.size === 0 && confirmed.size === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, confirmed]);

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty((d) => new Set(d).add(key));
  }

  function toggleConfirm(key: string, on: boolean) {
    setConfirmed((c) => {
      const n = new Set(c);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });
  }

  const fv = (key: string) => fieldValues.find((f) => f.field === key);
  const jenis = (values.jenis || null) as Jenis | null;
  const problemFor = (key: string) => problems.find((p) => p.field === key && p.code !== 'UNCONFIRMED');
  const warningFor = (key: string) => warnings.filter((w) => w.field === key);

  function input(f: FieldDef) {
    const v = values[f.key] ?? '';
    const disabled = !editable;
    const onChange = (e: { target: { value: string } }) => set(f.key, e.target.value);
    switch (f.type) {
      case 'textarea':
        return <textarea rows={2} value={v} onChange={onChange} disabled={disabled} />;
      case 'date':
        return <input type="date" value={v} onChange={onChange} disabled={disabled} />;
      case 'url':
        return <input type="url" value={v} onChange={onChange} disabled={disabled} placeholder="https://pdki-indonesia.dgip.go.id/..." />;
      case 'jenis':
        return (
          <select value={v} onChange={onChange} disabled={disabled}>
            <option value="">- pilih -</option>
            {Object.entries(JENIS_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        );
      case 'status_hki':
        return (
          <select value={v} onChange={onChange} disabled={disabled}>
            <option value="">- pilih -</option>
            {Object.entries(STATUS_HKI_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        );
      case 'master': {
        const items = master.filter((m) => m.kategori === f.master && (m.aktif || m.nilai === v));
        return (
          <select value={v} onChange={onChange} disabled={disabled}>
            <option value="">- pilih -</option>
            {items.map((m) => (
              <option key={m.nilai} value={m.nilai}>
                {m.label}
                {m.aktif ? '' : ' (nonaktif)'}
              </option>
            ))}
          </select>
        );
      }
      default:
        return <input value={v} onChange={onChange} disabled={disabled} />;
    }
  }

  function row(f: FieldDef, wide = false) {
    const value = fv(f.key);
    const level = value?.confidence != null && !value.diubah ? confidenceLevel(value.confidence, settings) : null;
    const confirm = needsConfirm(value, settings) && !dirty.has(f.key);
    const problem = problemFor(f.key);
    const revNote = revisionNotes?.[f.key];
    return (
      <div key={f.key} className={`field${wide || f.type === 'textarea' ? ' wide' : ''}${level ? ` conf-${level}` : ''}`}>
        <span className="field-label">
          {f.label}
          {level && value?.confidence != null && (
            <span className={`conf conf-${level}`} title={value.evidence ? `Kutipan: ${value.evidence}` : undefined}>
              {Math.round(value.confidence * 100)}%
            </span>
          )}
          {value?.page != null && (
            <button type="button" className="link-button" onClick={() => onJumpPage(value.page!)}>
              hal. {value.page}
            </button>
          )}
        </span>
        {input(f)}
        {f.help && <span className="muted small">{f.help}</span>}
        {problem && <span className="error-inline">{problem.message}</span>}
        {warningFor(f.key).map((w, i) => (
          <span key={i} className="warn-inline">
            {w.message}
          </span>
        ))}
        {revNote && <span className="warn-inline">Catatan validator: {revNote}</span>}
        {editable && confirm && (
          <label className="check small">
            <input type="checkbox" checked={confirmed.has(f.key)} onChange={(e) => toggleConfirm(f.key, e.target.checked)} />
            Nilai ini sudah saya periksa dan benar
          </label>
        )}
        {editable && value && value.nilai_ai !== (values[f.key] || null) && value.nilai_ai != null && (
          <button type="button" className="link-button" onClick={() => set(f.key, value.nilai_ai ?? '')}>
            Kembalikan nilai AI: “{value.nilai_ai}”
          </button>
        )}
        {onReviewNote && (
          <input
            className="review-note"
            placeholder="Catatan revisi untuk field ini (opsional)"
            value={reviewNotes?.[f.key] ?? ''}
            onChange={(e) => onReviewNote(f.key, e.target.value)}
          />
        )}
      </div>
    );
  }

  const pending = dirty.size + confirmed.size;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Metadata</h2>
        {editable && (
          <span className="muted small">
            {saving ? 'Menyimpan...' : pending > 0 ? `${pending} perubahan belum tersimpan (disimpan otomatis)` : savedAt ? `Tersimpan ${savedAt.toLocaleTimeString('id-ID')}` : ''}
          </span>
        )}
      </div>
      <div className="form">
        {fieldsFor(jenis).map((f) => row(f, f.key === 'judul'))}
        <div className="wide divider" />
        {MANUAL_FIELDS.map((f) => row(f))}
        {VALIDITY_FIELDS.map((f) => row(f))}
        {editable && (
          <div className="form-actions">
            <button type="button" onClick={() => save()} disabled={saving || pending === 0}>
              Simpan sekarang
            </button>
            {pending > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setValues(recordValues(record));
                  setDirty(new Set());
                  setConfirmed(new Set());
                }}
              >
                Batalkan perubahan
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
