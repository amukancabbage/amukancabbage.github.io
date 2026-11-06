import { useEffect, useEffectEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import FieldForm from '../../components/haki/FieldForm';
import HistoryTimeline from '../../components/haki/HistoryTimeline';
import PersonsEditor from '../../components/haki/PersonsEditor';
import RecordViewer from '../../components/haki/RecordViewer';
import StatusBadge from '../../components/haki/StatusBadge';
import WorkflowActions, { isTyping } from '../../components/haki/WorkflowActions';
import { HakiError, errorText, loadMaster, loadSettings, rpc, type HakiSettings } from '../../haki/api';
import { BULK_REASON, JENIS_LABEL, aiErrorText } from '../../haki/constants';
import { fmtDate } from '../../haki/format';
import { neighbours } from '../../haki/queueContext';
import type {
  FieldValue,
  HistoryItem,
  HkiFile,
  HkiPerson,
  HkiRecord,
  MasterItem,
  RecordMeta,
  ReviewAction,
} from '../../haki/types';
import { supabase } from '../../lib/supabase';

type Data = {
  record: HkiRecord;
  files: HkiFile[];
  persons: HkiPerson[];
  fieldValues: FieldValue[];
  meta: RecordMeta;
  history: HistoryItem[];
  lastRevision: ReviewAction | null;
  ownerNama: string | null;
  unitNama: string | null;
};

async function loadAll(id: string): Promise<Data | null> {
  const { data: record } = await supabase.from('hki_records').select('*').eq('id', id).maybeSingle();
  // tidak terlihat = tidak ada (404)
  if (!record) return null;
  const [files, persons, fv, meta, history, revisions, owner, unit] = await Promise.all([
    supabase.from('hki_files').select('*').eq('record_id', id).order('jenis', { ascending: false }).order('created_at'),
    supabase.from('hki_persons').select('*, dosen(nama)').eq('record_id', id).order('urutan'),
    supabase.from('hki_field_values').select('*').eq('record_id', id),
    rpc<RecordMeta>('hki_record_meta', { p_record: id }),
    rpc<HistoryItem[]>('hki_history', { p_record: id }),
    supabase.from('hki_review_actions').select('*').eq('record_id', id).order('created_at', { ascending: false }).limit(1),
    supabase.from('dosen').select('nama').eq('id', record.owner_dosen_id).maybeSingle(),
    record.unit_id ? supabase.from('units').select('nama').eq('id', record.unit_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const last = (revisions.data?.[0] as ReviewAction | undefined) ?? null;
  return {
    record: record as HkiRecord,
    files: (files.data as HkiFile[]) ?? [],
    persons: (persons.data as HkiPerson[]) ?? [],
    fieldValues: (fv.data as FieldValue[]) ?? [],
    meta,
    history,
    lastRevision: last && (last.aksi === 'request_revision' || last.aksi === 'reject') ? last : null,
    ownerNama: owner.data?.nama ?? null,
    unitNama: (unit.data as { nama: string } | null)?.nama ?? null,
  };
}

export default function HakiRecordPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [settings, setSettings] = useState<HakiSettings | null>(null);
  const [master, setMaster] = useState<MasterItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [jump, setJump] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [help, setHelp] = useState(false);
  const [reload, setReload] = useState(0);
  const nav = neighbours(id);

  useEffect(() => {
    loadSettings().then(setSettings);
    loadMaster().then(setMaster);
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadAll(id)
      .then((d) => {
        if (!alive) return;
        setMissing(!d);
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof HakiError && e.code === 'NOT_FOUND') setMissing(true);
        else setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [id, reload]);

  useEffect(() => {
    setReviewNotes({});
    setConflict(null);
  }, [id]);

  // sedang dibaca AI: cek berkala; sapu stale menandai TIMEOUT
  useEffect(() => {
    if (data?.record.workflow_status !== 'EXTRACTING') return;
    const t = window.setTimeout(async () => {
      await rpc('hki_sweep_stale').catch(() => undefined);
      setReload((n) => n + 1);
    }, 5000);
    return () => window.clearTimeout(t);
  }, [data]);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (isTyping(e) || !nav) return;
    if (e.key === 'n' && nav.next) navigate(`/haki/dokumen/${nav.next}`);
    if (e.key === 'p' && nav.prev) navigate(`/haki/dokumen/${nav.prev}`);
    if (e.key === '?') setHelp((h) => !h);
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  async function saveFields(fields: Record<string, string>, confirmFields: string[]): Promise<boolean> {
    if (!data) return false;
    try {
      await rpc<number>('hki_update_fields', {
        p_record: data.record.id,
        p_versi: data.record.versi,
        p_fields: fields,
        p_confirm: confirmFields,
      });
      setReload((n) => n + 1);
      return true;
    } catch (e) {
      if (e instanceof HakiError && e.code === 'VERSION_CONFLICT') setConflict(e.message);
      else setError(errorText(e));
      return false;
    }
  }

  function afterAction(opts?: { decided?: boolean; deleted?: boolean }) {
    if (opts?.deleted) {
      navigate('/haki/saya');
      return;
    }
    if (opts?.decided && nav?.next) {
      navigate(`/haki/dokumen/${nav.next}`);
      return;
    }
    if (opts?.decided && nav) {
      navigate(nav.back);
      return;
    }
    setReload((n) => n + 1);
  }

  if (missing) {
    return (
      <div className="page">
        <h1>Dokumen tidak ditemukan</h1>
        <p className="muted">Dokumen ini tidak ada atau Anda tidak berhak membukanya.</p>
        <Link to="/haki">Kembali ke Beranda HAKI</Link>
      </div>
    );
  }
  if (error && !data) return <p className="error">{error}</p>;
  if (!data || !settings) return <p>Memuat...</p>;

  const { record, meta } = data;
  const editable = meta.caps.edit;
  const reviewing = meta.caps.review;

  return (
    <div className="page record-page">
      <div className="record-head">
        <div>
          <div className="crumbs">
            {nav ? <Link to={nav.back}>‹ Antrean</Link> : <Link to="/haki/saya">‹ HKI Saya</Link>}
            {nav && (
              <span className="queue-nav">
                <button className="secondary" disabled={!nav.prev} onClick={() => navigate(`/haki/dokumen/${nav.prev}`)} title="Pintasan: P">
                  Sebelumnya
                </button>
                <span className="small">
                  {nav.index + 1} / {nav.total}
                </span>
                <button className="secondary" disabled={!nav.next} onClick={() => navigate(`/haki/dokumen/${nav.next}`)} title="Pintasan: N">
                  Berikutnya
                </button>
              </span>
            )}
          </div>
          <h1>{record.judul || '(tanpa judul)'}</h1>
          <p className="muted">
            {record.jenis ? JENIS_LABEL[record.jenis] : 'Jenis belum diisi'} · Pemilik: {data.ownerNama ?? '-'}
            {data.unitNama ? ` · ${data.unitNama}` : ''} · Diunggah {fmtDate(record.created_at)} · Versi {record.versi}
          </p>
        </div>
        <StatusBadge status={record.workflow_status} />
      </div>

      {help && (
        <div className="notice">
          Pintasan: <kbd>N</kbd> berikutnya, <kbd>P</kbd> sebelumnya, <kbd>A</kbd> setujui, <kbd>R</kbd> minta revisi,{' '}
          <kbd>?</kbd> tampil/sembunyikan bantuan.
        </div>
      )}
      {conflict && (
        <div className="notice warn-box">
          {conflict}{' '}
          <button
            className="secondary"
            onClick={() => {
              setConflict(null);
              setReload((n) => n + 1);
            }}
          >
            Muat ulang
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {record.workflow_status === 'EXTRACTING' && <div className="notice">AI sedang membaca dokumen. Halaman ini diperbarui otomatis.</div>}
      {record.workflow_status === 'EXTRACTION_FAILED' && (
        <div className="notice warn-box">
          AI gagal membaca dokumen: {aiErrorText(record.extra?.extraction_error)} (kode{' '}
          {String(record.extra?.extraction_error ?? '-')}). Isi data secara manual atau coba baca ulang.
        </div>
      )}
      {data.lastRevision && ['NEEDS_REVISION', 'REJECTED'].includes(record.workflow_status) && (
        <div className="notice warn-box">
          <strong>{data.lastRevision.aksi === 'reject' ? 'Alasan penolakan' : 'Catatan revisi validator'}:</strong>{' '}
          {data.lastRevision.catatan ?? 'lihat catatan per field.'}
        </div>
      )}
      {meta.duplicates.total > 0 && (
        <div className="notice warn-box">
          Ada {meta.duplicates.total} kemungkinan duplikat.
          {meta.duplicates.items.map((d) => (
            <div key={d.id} className="small">
              <Link to={`/haki/dokumen/${d.id}`}>{d.judul || '(tanpa judul)'}</Link> — sama {d.alasan.replace('_', ' ')}
              {d.alasan === 'judul' ? ` (${Math.round(d.skor * 100)}%)` : ''}
            </div>
          ))}
        </div>
      )}
      {reviewing && meta.bulk_ineligible && (
        <p className="muted small">Tidak layak setujui massal: {BULK_REASON[meta.bulk_ineligible] ?? meta.bulk_ineligible}.</p>
      )}

      <div className="record-grid">
        <div className="record-main">
          <WorkflowActions record={record} meta={meta} reviewNotes={reviewNotes} onDone={afterAction} />
          <FieldForm
            key={record.id}
            record={record}
            fieldValues={data.fieldValues}
            master={master}
            settings={settings}
            editable={editable}
            problems={meta.problems}
            warnings={meta.warnings}
            revisionNotes={data.lastRevision?.catatan_field ?? null}
            reviewNotes={reviewing ? reviewNotes : null}
            onReviewNote={reviewing ? (f, v) => setReviewNotes((n) => ({ ...n, [f]: v })) : undefined}
            onSave={saveFields}
            onJumpPage={setJump}
          />
          <PersonsEditor
            record={record}
            persons={data.persons}
            editable={meta.caps.edit_persons}
            onSaved={() => setReload((n) => n + 1)}
            onConflict={setConflict}
          />
          {meta.warnings.filter((w) => !w.field).length > 0 && (
            <div className="card pad">
              <h2>Peringatan</h2>
              <ul>
                {meta.warnings
                  .filter((w) => !w.field)
                  .map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
              </ul>
            </div>
          )}
          <HistoryTimeline items={data.history} />
        </div>
        <div className="record-side">
          <RecordViewer
            recordId={record.id}
            files={data.files}
            canUpload={meta.caps.upload}
            jumpPage={jump}
            onChanged={() => setReload((n) => n + 1)}
          />
        </div>
      </div>
    </div>
  );
}
