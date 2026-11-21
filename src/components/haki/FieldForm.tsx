import { CircleAlert, RotateCcw, Save } from 'lucide-react';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { IconLabel } from '../AppIcon';
import { useUnsavedDraft } from '../DraftGuard';
import SearchSelect from '../SearchSelect';
import type { HakiSettings } from '../../haki/api';
import {
  COMMON_FIELDS,
  JENIS_LABEL,
  MANUAL_FIELDS,
  SPECIFIC_FIELDS,
  STATUS_HKI_LABEL,
  VALIDITY_FIELDS,
  fieldLabel,
  fieldsFor,
  type FieldDef,
} from '../../haki/constants';
import type { FieldValue, HkiRecord, Jenis, MasterItem, Problem } from '../../haki/types';

const AUTOSAVE_MS = 10000;

type Values = Record<string, string>;
type Draft = {
  version: number;
  values: Values;
  dirty: Set<string>;
  confirmed: Set<string>;
};
export type FieldSaveResult =
  | { type: 'saved'; version: number }
  | { type: 'conflict'; record: HkiRecord }
  | { type: 'failed'; message: string };

function fromRecord(record: HkiRecord): Draft {
  return { version: record.versi, values: recordValues(record), dirty: new Set(), confirmed: new Set() };
}

function validFields(values: Values) {
  return new Set([...fieldsFor((values.jenis || null) as Jenis | null), ...MANUAL_FIELDS, ...VALIDITY_FIELDS].map((f) => f.key));
}

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
  onSave: (fields: Values, confirm: string[], version: number) => Promise<FieldSaveResult>;
  onPendingChange: (pending: boolean) => void;
  locked?: boolean;
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
  onPendingChange,
  locked = false,
  onJumpPage,
}: Props) {
  const [draft, setDraft] = useState(() => fromRecord(record));
  const latest = useRef(draft);
  const flight = useRef<Promise<boolean> | null>(null);
  const conflictPanel = useRef<HTMLElement>(null);
  const id = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<HkiRecord | null>(null);
  const [choices, setChoices] = useState<Record<string, 'local' | 'server'>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const { values, dirty, confirmed } = draft;
  const pending = new Set([...dirty, ...confirmed]).size;

  function update(next: Draft) {
    latest.current = next;
    setDraft(next);
  }

  // Sinkronkan data yang dimuat ulang hanya setelah draf bersih.
  useEffect(() => {
    const current = latest.current;
    if (flight.current || current.dirty.size || current.confirmed.size || record.versi < current.version) return;
    const next = fromRecord(record);
    if (current.version !== next.version || JSON.stringify(current.values) !== JSON.stringify(next.values)) update(next);
  }, [record, saving]);

  useEffect(() => { onPendingChange(pending > 0 || saving); }, [onPendingChange, pending, saving]);
  useEffect(() => { if (conflict) conflictPanel.current?.focus(); }, [conflict]);

  function discard() {
    update(fromRecord(conflict ?? record));
    setError('');
    setConflict(null);
  }

  async function saveDraft() {
    const sent = latest.current;
    const fields = Object.fromEntries([...sent.dirty].map((key) => [key, sent.values[key]]));
    const result = await onSave(fields, [...sent.confirmed], sent.version);
    if (result.type === 'conflict') {
      setConflict(result.record);
      setChoices({});
      return false;
    }
    if (result.type === 'failed') {
      setError(result.message);
      return false;
    }
    const current = latest.current;
    update({
      ...current,
      version: result.version,
      dirty: new Set([...current.dirty].filter((key) => !sent.dirty.has(key) || current.values[key] !== sent.values[key])),
      confirmed: new Set([...current.confirmed].filter((key) => !sent.confirmed.has(key))),
    });
    setSavedAt(new Date());
    return true;
  }

  function save() {
    if (flight.current) return flight.current;
    if (locked || conflict || !editable) return Promise.resolve(false);
    if (!latest.current.dirty.size && !latest.current.confirmed.size) return Promise.resolve(true);
    setError('');
    setSaving(true);
    flight.current = saveDraft()
      .catch(() => { setError('Metadata gagal disimpan. Coba lagi.'); return false; })
      .finally(() => { flight.current = null; setSaving(false); });
    return flight.current;
  }

  async function flush() {
    while (flight.current || latest.current.dirty.size || latest.current.confirmed.size) {
      if (!await save()) return false;
    }
    return true;
  }

  const paused = useUnsavedDraft({ dirty: pending > 0, saving, save: editable && !locked && !conflict ? flush : undefined, discard });
  const autosave = useEffectEvent(() => void save());

  useEffect(() => {
    if (!editable || !pending || saving || paused || conflict || error || locked) return;
    const timer = window.setTimeout(autosave, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [editable, pending, values, confirmed, saving, paused, conflict, error, locked]);

  function set(key: string, value: string) {
    const current = latest.current;
    const values = { ...current.values, [key]: value };
    const allowed = validFields(values);
    update({
      ...current,
      values,
      dirty: new Set([...current.dirty, key].filter((field) => allowed.has(field))),
      confirmed: new Set([...current.confirmed].filter((field) => field !== key && allowed.has(field))),
    });
    if (error) setError('');
  }

  function toggleConfirm(key: string, on: boolean) {
    const current = latest.current;
    const confirmed = new Set(current.confirmed);
    if (on) confirmed.add(key);
    else confirmed.delete(key);
    update({ ...current, confirmed });
  }

  const conflictKeys = [...new Set([...dirty, ...confirmed])];

  function resolveConflict() {
    if (!conflict) return;
    const replacement = fromRecord(conflict);
    for (const key of conflictKeys) {
      if (choices[key] !== 'local') continue;
      if (dirty.has(key)) {
        replacement.values[key] = values[key];
        replacement.dirty.add(key);
      }
      if (confirmed.has(key)) replacement.confirmed.add(key);
    }
    const allowed = validFields(replacement.values);
    replacement.dirty = new Set([...replacement.dirty].filter((key) => allowed.has(key)));
    replacement.confirmed = new Set([...replacement.confirmed].filter((key) => allowed.has(key)));
    update(replacement);
    setConflict(null);
    setError('');
  }

  const fv = (key: string) => fieldValues.find((f) => f.field === key);
  const jenis = (values.jenis || null) as Jenis | null;
  const problemFor = (key: string) => problems.find((p) => p.field === key && p.code !== 'UNCONFIRMED');
  const warningFor = (key: string) => warnings.filter((w) => w.field === key);

  function input(f: FieldDef, inputId: string, describedBy?: string) {
    const v = values[f.key] ?? '';
    const common = {
      id: inputId,
      'aria-describedby': describedBy,
      disabled: !editable || locked || !!conflict,
    };
    const onChange = (e: { target: { value: string } }) => set(f.key, e.target.value);
    switch (f.type) {
      case 'textarea':
        return <textarea rows={2} value={v} onChange={onChange} {...common} />;
      case 'date':
        return <input type="date" value={v} onChange={onChange} {...common} />;
      case 'url':
        return <input type="url" value={v} onChange={onChange} {...common} placeholder="https://pdki-indonesia.dgip.go.id/..." />;
      case 'jenis':
        return (
          <select value={v} onChange={onChange} {...common}>
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
          <select value={v} onChange={onChange} {...common}>
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
        if (f.master === 'jenis_ciptaan') {
          const choices = items.map((m) => ({ value: m.nilai, label: m.label + (m.aktif ? '' : ' (nonaktif)') }));
          const selected = v ? choices.find((item) => item.value === v) ?? { value: v, label: v } : null;
          return <SearchSelect id={inputId} label={f.label} describedBy={describedBy} disabled={common.disabled}
            items={choices} selected={selected} clearable placeholder="Cari jenis ciptaan"
            onPick={(item) => set(f.key, item?.value ?? '')} />;
        }
        return (
          <select value={v} onChange={onChange} {...common}>
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
        return <input value={v} onChange={onChange} {...common} />;
    }
  }

  function row(f: FieldDef, wide = false) {
    const value = fv(f.key);
    const level = value?.confidence != null && !value.diubah ? confidenceLevel(value.confidence, settings) : null;
    const confirm = needsConfirm(value, settings) && !dirty.has(f.key);
    const problem = problemFor(f.key);
    const revNote = revisionNotes?.[f.key];
    const inputId = id + '-' + f.key;
    const related = [f.help && inputId + '-help', problem && inputId + '-problem'].filter(Boolean).join(' ') || undefined;
    return (
      <div key={f.key} className={`field${wide || f.type === 'textarea' ? ' wide' : ''}${level ? ` conf-${level}` : ''}`}>
        <span className="field-label">
          <label htmlFor={inputId}>{f.label}</label>
          {level && value?.confidence != null && (
            <span className={`conf conf-${level}`} title={value.evidence ? `Kutipan: ${value.evidence}` : undefined}>
              {Math.round(value.confidence * 100)}%
            </span>
          )}
          {value?.page != null && (
            <button type="button" className="link-button" aria-label={'Lihat halaman ' + value.page + ' untuk ' + f.label} onClick={() => onJumpPage(value.page!)}>
              hal. {value.page}
            </button>
          )}
        </span>
        {input(f, inputId, related)}
        {f.help && <span id={inputId + '-help'} className="muted small">{f.help}</span>}
        {problem && <span id={inputId + '-problem'} className="error-inline">{problem.message}</span>}
        {warningFor(f.key).map((w, i) => (
          <span key={i} className="warn-inline">
            {w.message}
          </span>
        ))}
        {revNote && <span className="warn-inline">Catatan validator: {revNote}</span>}
        {editable && confirm && (
          <label className="check small">
            <input type="checkbox" aria-label={'Konfirmasi ' + f.label} disabled={saving || locked || !!conflict} checked={confirmed.has(f.key)} onChange={(e) => toggleConfirm(f.key, e.target.checked)} />
            Nilai ini sudah saya periksa dan benar
          </label>
        )}
        {editable && value && value.nilai_ai !== (values[f.key] || null) && value.nilai_ai != null && (
          <button type="button" className="link-button" disabled={locked || !!conflict} onClick={() => set(f.key, value.nilai_ai ?? '')}>
            Kembalikan nilai AI: “{value.nilai_ai}”
          </button>
        )}
        {onReviewNote && (
          <input
            className="review-note"
            aria-label={'Catatan revisi untuk ' + f.label}
            placeholder="Catatan revisi untuk field ini (opsional)"
            value={reviewNotes?.[f.key] ?? ''}
            onChange={(e) => onReviewNote(f.key, e.target.value)}
          />
        )}
      </div>
    );
  }


  return (
    <div className="card metadata-card">
      <div className={`card-head${editable ? ' metadata-toolbar' : ''}`}>
        <h2>Metadata</h2>
        {editable && (
          <div className="save-controls">
            <span className="muted small" role="status">
              {saving ? 'Menyimpan...' : conflict ? 'Konflik versi' : error ? 'Gagal disimpan'
                : pending > 0 ? `${pending} perubahan belum tersimpan` : savedAt ? `Tersimpan ${savedAt.toLocaleTimeString('id-ID')}` : ''}
            </span>
            {conflict ? (
              <button type="button" className="secondary" onClick={() => conflictPanel.current?.focus()}><IconLabel icon={CircleAlert}>Tinjau konflik</IconLabel></button>
            ) : (
              <button type="button" onClick={() => void save()} disabled={saving || locked || pending === 0}>
                <IconLabel icon={error ? RotateCcw : Save}>{error ? 'Coba simpan lagi' : 'Simpan sekarang'}</IconLabel>
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="error pad" role="alert">{error}</p>}
      {conflict && (
        <section className="pad conflict-panel" tabIndex={-1} ref={conflictPanel} aria-label="Konflik versi">
          <h3>Dokumen berubah saat Anda mengedit</h3>
          <p>Pilih nilai untuk setiap isian sebelum menyimpan lagi.</p>
          {conflictKeys.map((key) => (
            <fieldset key={key} className="conflict-field">
              <legend>{fieldLabel(key)}</legend>
              <label className="check">
                <input type="radio" name={id + key} checked={choices[key] === 'local'} onChange={() => setChoices((current) => ({ ...current, [key]: 'local' }))} />
                Saya: {values[key] || '–'}{confirmed.has(key) ? ' (konfirmasi)' : ''}
              </label>
              <label className="check">
                <input type="radio" name={id + key} checked={choices[key] === 'server'} onChange={() => setChoices((current) => ({ ...current, [key]: 'server' }))} />
                Server: {recordValues(conflict)[key] || '–'}
              </label>
            </fieldset>
          ))}
          <button type="button" disabled={conflictKeys.some((key) => !choices[key])} onClick={resolveConflict}>Gunakan pilihan</button>
        </section>
      )}
      <section className="metadata-section">
        <h3>Identitas HKI</h3>
        <div className="form">{COMMON_FIELDS.map((f) => row(f, f.key === 'judul'))}</div>
      </section>
      {jenis && SPECIFIC_FIELDS[jenis].length > 0 && (
        <section className="metadata-section">
          <h3>Rincian {JENIS_LABEL[jenis]}</h3>
          <div className="form">{SPECIFIC_FIELDS[jenis].map((f) => row(f))}</div>
        </section>
      )}
      <section className="metadata-section">
        <h3>Informasi tambahan</h3>
        <div className="form">{[...MANUAL_FIELDS, ...VALIDITY_FIELDS].map((f) => row(f))}</div>
      </section>
      {editable && pending > 0 && (
        <div className="metadata-discard">
          <button type="button" className="secondary" disabled={saving} onClick={discard}>Batalkan perubahan</button>
        </div>
      )}
    </div>
  );
}
