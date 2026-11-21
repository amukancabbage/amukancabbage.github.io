import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProfile } from '../../auth';
import AsyncState from '../../components/AsyncState';
import Tabs from '../../components/Tabs';
import { useUnsavedDraft } from '../../components/DraftGuard';
import FieldForm, { type FieldSaveResult } from '../../components/haki/FieldForm';
import HistoryTimeline from '../../components/haki/HistoryTimeline';
import PersonsEditor from '../../components/haki/PersonsEditor';
import RecordViewer from '../../components/haki/RecordViewer';
import StatusBadge from '../../components/haki/StatusBadge';
import WorkflowActions, { isTyping } from '../../components/haki/WorkflowActions';
import { HakiError, errorText, loadMaster, loadSettings, rpc, toHakiError, type HakiSettings } from '../../haki/api';
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
import { useMediaQuery } from '../../lib/useMediaQuery';

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
  const { data: record, error } = await supabase.from('hki_records').select('*').eq('id', id).maybeSingle();
  if (error) throw toHakiError(error);
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
  for (const result of [files, persons, fv, revisions, owner, unit]) {
    if ('error' in result && result.error) throw toHakiError(result.error);
  }
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

const recordTabs = [{ key: 'metadata', label: 'Metadata' }, { key: 'files', label: 'Berkas' }] as const;

export default function HakiRecordPage() {
  const { id = '' } = useParams();
  return <RecordDetail key={id} id={id} />;
}

function RecordDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useProfile();
  const from = (location.state as { from?: string } | null)?.from;
  const fallback = profile.role === 'dosen' || profile.role === 'operator' ? '/haki/saya'
    : profile.role === 'admin' ? '/beranda' : '/haki/arsip';
  const fromList = ['/haki/saya', '/haki/arsip'].includes(from?.split('?')[0] ?? '');
  const back = fromList && from ? from : fallback;
  const split = useMediaQuery('(min-width: 1200px)');
  const [tab, setTab] = useState<'metadata' | 'files'>('metadata');
  const filePanel = useRef<HTMLElement>(null);
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [settings, setSettings] = useState<HakiSettings | null>(null);
  const [master, setMaster] = useState<MasterItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [jump, setJump] = useState<{ page: number } | null>(null);
  const [writtenVersion, setWrittenVersion] = useState(0);
  const [metadataPending, setMetadataPending] = useState(false);
  const [personsPending, setPersonsPending] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [decision, setDecision] = useState<{ deleted?: boolean } | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [help, setHelp] = useState(false);
  const [reload, setReload] = useState(0);
  const nav = profile.role === 'validator' && !fromList ? neighbours(id) : null;

  useEffect(() => {
    if (settings) return;
    let alive = true;
    void Promise.all([loadSettings(), loadMaster()])
      .then(([settings, master]) => { if (alive) { setSettings(settings); setMaster(master); } })
      .catch(() => { if (alive) setError('Pengaturan HKI gagal dimuat.'); });
    return () => { alive = false; };
  }, [settings, reload]);

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

  useUnsavedDraft({
    dirty: Object.values(reviewNotes).some((note) => note.trim()),
    discard: () => setReviewNotes({}),
  });

  useEffect(() => {
    if (!decision) return;
    if (decision.deleted) navigate('/haki/saya');
    else if (nav?.next) navigate('/haki/dokumen/' + nav.next);
    else if (nav) navigate(nav.back);
    else setReload((n) => n + 1);
    setDecision(null);
  }, [decision, navigate, nav]);

  useEffect(() => {
    if (jump) filePanel.current?.focus();
  }, [jump]);

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
    if (isTyping(e) || !nav || !(e.target instanceof HTMLElement && e.target.closest('[data-record-shortcuts]'))) return;
    if (e.key === 'n' && nav.next) navigate(`/haki/dokumen/${nav.next}`);
    if (e.key === 'p' && nav.prev) navigate(`/haki/dokumen/${nav.prev}`);
    if (e.key === '?') setHelp((h) => !h);
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function afterWrite(version?: number) {
    if (version != null) setWrittenVersion((current) => Math.max(current, version));
    setReload((n) => n + 1);
  }

  async function saveFields(fields: Record<string, string>, confirmFields: string[], expected: number): Promise<FieldSaveResult> {
    try {
      const version = await rpc<number>('hki_update_fields', {
        p_record: id,
        p_versi: expected,
        p_fields: fields,
        p_confirm: confirmFields,
      });
      afterWrite(version);
      return { type: 'saved', version };
    } catch (e) {
      if (e instanceof HakiError && e.code === 'VERSION_CONFLICT') {
        const { data: latest, error } = await supabase.from('hki_records').select('*').eq('id', id).maybeSingle();
        if (!error && latest) {
          afterWrite(latest.versi);
          return { type: 'conflict', record: latest as HkiRecord };
        }
        return { type: 'failed', message: 'Versi terbaru gagal dimuat. Draf masih tersedia di halaman ini.' };
      }
      return { type: 'failed', message: errorText(e) };
    }
  }

  function afterAction(opts?: { decided?: boolean; deleted?: boolean; version?: number }) {
    if (opts?.deleted || opts?.decided) {
      setReviewNotes({});
      setDecision({ deleted: opts.deleted });
    } else {
      afterWrite(opts?.version);
    }
  }

  if (missing) {
    return (
      <div className="page">
        <h1>Dokumen tidak ditemukan</h1>
        <p className="muted">Dokumen ini tidak ada atau Anda tidak berhak membukanya.</p>
        <Link to={fallback}>Kembali ke daftar</Link>
      </div>
    );
  }
  if (error && (!data || !settings)) return <AsyncState error={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!data || !settings) return <AsyncState loading />;

  const { meta } = data;
  const record = { ...data.record, versi: Math.max(data.record.versi, writtenVersion) };
  const editable = meta.caps.edit;
  const reviewing = meta.caps.review;

  return (
    <div className="page record-page">
      <div className="record-head">
        <div>
          <div className="crumbs" data-record-shortcuts>
            {nav ? <Link to={nav.back}>‹ Antrean</Link> : <Link to={back}>‹ Kembali ke daftar</Link>}
            {nav && (
              <span className="queue-nav">
                <button className="secondary" disabled={!nav.prev} onClick={() => navigate(`/haki/dokumen/${nav.prev}`)} title="Pintasan: P">
                  Sebelumnya
                </button>
                <span className="small" aria-label="Posisi antrean">
                  {nav.index + 1} / {nav.total}
                </span>
                <button className="secondary" disabled={!nav.next} onClick={() => navigate(`/haki/dokumen/${nav.next}`)} title="Pintasan: N">
                  Berikutnya
                </button>
              </span>
            )}
            {nav && <button type="button" className="link-button" onClick={() => setHelp((value) => !value)} aria-expanded={help}>Pintasan</button>}
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
      {error && <AsyncState error={error} onRetry={() => setReload((n) => n + 1)} />}
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

      {!split && <Tabs id="record" label="Bagian dokumen" tabs={recordTabs} value={tab} onChange={setTab} />}
      <div className="record-grid">
        <section
          id="record-panel-metadata"
          className="record-main"
          role={split ? undefined : 'tabpanel'}
          aria-labelledby={split ? undefined : 'record-tab-metadata'}
          hidden={!split && tab !== 'metadata'}
        >
          <WorkflowActions
            record={record}
            meta={meta}
            reviewNotes={reviewNotes}
            blocked={metadataPending || personsPending || fileBusy}
            onBusyChange={setActionBusy}
            onDone={afterAction}
          />
          <FieldForm
            key={record.id}
            record={data.record}
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
            locked={personsPending || fileBusy || actionBusy}
            onPendingChange={setMetadataPending}
            onJumpPage={(page) => { setTab('files'); setJump({ page }); }}
          />
          <PersonsEditor
            record={record}
            persons={data.persons}
            editable={meta.caps.edit_persons}
            locked={metadataPending || fileBusy || actionBusy}
            onPendingChange={setPersonsPending}
            onSaved={afterWrite}
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
          <details className="card history-disclosure" open><summary>Riwayat dokumen</summary><HistoryTimeline items={data.history} /></details>
        </section>
        <section
          id="record-panel-files"
          className="record-side"
          ref={filePanel}
          tabIndex={-1}
          role={split ? undefined : 'tabpanel'}
          aria-labelledby={split ? undefined : 'record-tab-files'}
          hidden={!split && tab !== 'files'}
        >
          <RecordViewer
            recordId={record.id}
            files={data.files}
            canUpload={meta.caps.upload}
            jumpPage={jump}
            active={split || tab === 'files'}
            locked={metadataPending || personsPending || actionBusy}
            onBusyChange={setFileBusy}
            onChanged={() => setReload((n) => n + 1)}
          />
        </section>
      </div>
    </div>
  );
}
