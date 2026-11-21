import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AsyncState from '../../components/AsyncState';
import Dialog from '../../components/Dialog';
import ListPagination from '../../components/ListPagination';
import ResponsiveList, { type ListColumn } from '../../components/ResponsiveList';
import RecordFilters from '../../components/haki/RecordFilters';
import { errorText, rpc } from '../../haki/api';
import { BULK_REASON, JENIS_LABEL } from '../../haki/constants';
import { daysBetween } from '../../haki/format';
import { saveQueue } from '../../haki/queueContext';
import type { HkiListRow } from '../../haki/types';
import { useRecordList } from '../../haki/useRecordList';

const PAGE = 50;
type BulkResult = { approved: string[]; skipped: { id: string; reason: string }[] };

export default function HakiQueuePage() {
  const location = useLocation();
  const list = useRecordList('queue', PAGE);
  const { rows } = list;
  const [selecting, setSelecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<(BulkResult & { titles: Record<string, string> }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setSelecting(false);
    setConfirming(false);
    setSelected(new Set());
  }, [location.search, rows]);

  function changeMode() {
    setSelecting(!selecting);
    setSelected(new Set());
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function bulk() {
    if (busy || !selected.size || selected.size > 100) return;
    setConfirming(false);
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await rpc<BulkResult>('hki_bulk_approve', { p_ids: [...selected] });
      setResult({ ...response, titles: Object.fromEntries(rows.map((row) => [row.id, row.judul || '(Tanpa judul)'])) });
      setSelecting(false);
      setSelected(new Set());
      list.retry();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // UI "layak cepat" lebih longgar; keputusan akhir di server
  const quick = (row: HkiListRow) => list.settings != null && row.min_confidence != null && row.min_confidence >= list.settings.high;
  const columns: ListColumn<HkiListRow>[] = [
    { label: 'Judul', render: (row) => (
      <Link to={'/haki/dokumen/' + row.id} onClick={() => saveQueue(rows.map((item) => item.id), location.pathname + location.search)}>
        {row.judul || '(Tanpa judul)'}
      </Link>
    ) },
    { label: 'Dosen', render: (row) => row.owner_nama ?? '–' },
    { label: 'Menunggu', render: (row) => row.submitted_at ? daysBetween(row.submitted_at) + ' hari' : '–' },
    { label: 'Keyakinan', visibility: 'desktop', render: (row) => row.min_confidence == null ? 'Tanpa skor AI' : Math.round(row.min_confidence * 100) + '%' },
    { label: 'Jenis', visibility: 'detail', render: (row) => row.jenis ? JENIS_LABEL[row.jenis] : '–' },
    { label: 'Unit', visibility: 'detail', render: (row) => row.unit_nama ?? '–' },
  ];
  const showRows = !list.loading && !list.error;

  return (
    <div className="page">
      <header className="page-header"><h1>Antrean Validasi</h1></header>
      <RecordFilters
        value={list.filters} units={list.units} master={list.master} showQueue onChange={list.updateFilters}
        total={showRows ? list.total : null}
        actions={showRows && rows.length > 0 && (
          <button type="button" className="secondary" aria-expanded={selecting} aria-controls="bulk-selection" disabled={busy} onClick={changeMode}>
            {selecting ? 'Selesai memilih' : 'Pilih dokumen'}
          </button>
        )}
      />
      {error && <p className="error" role="alert">{error}</p>}
      {result && (
        <div className="notice" role="status">
          {result.approved.length} disetujui. {result.skipped.length} dilewati.
          {!!result.skipped.length && (
            <ul className="small">
              {result.skipped.map((item) => <li key={item.id}>{result.titles[item.id]} · {BULK_REASON[item.reason] ?? item.reason}</li>)}
            </ul>
          )}
        </div>
      )}
      <AsyncState loading={list.loading} error={list.error} onRetry={list.retry} empty={!rows.length ? 'Tidak ada pengajuan yang cocok.' : undefined} />
      <div id="bulk-selection" hidden={!selecting || !showRows}>
        <div className="card selection-toolbar" aria-label="Pilihan dokumen pada halaman ini">
          <label className="check list-checkbox">
            <input type="checkbox" disabled={busy} checked={rows.length > 0 && selected.size === rows.length}
              onChange={(event) => setSelected(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())} />
            Pilih semua di halaman ini
          </label>
          <button type="button" className="secondary" disabled={busy} onClick={() => setSelected(new Set(rows.filter(quick).map((row) => row.id)))}>Pilih yang layak cepat</button>
          <button type="button" onClick={() => setConfirming(true)} disabled={busy || selected.size === 0}>
            {busy ? 'Menyetujui…' : `Setujui terpilih (${selected.size})`}
          </button>
        </div>
      </div>
      {showRows && <>
        <ResponsiveList
          rows={rows}
          columns={columns}
          caption="Antrean validasi"
          select={selecting ? (row) => (
            <label className="list-checkbox">
              <input type="checkbox" aria-label={'Pilih ' + (row.judul || 'dokumen tanpa judul')}
                disabled={busy} checked={selected.has(row.id)} onChange={(event) => toggle(row.id, event.target.checked)} />
            </label>
          ) : undefined}
        />
        <ListPagination total={list.total} pageSize={PAGE} showTotal={false} />
      </>}
      {confirming && (
        <Dialog title="Setujui dokumen terpilih" onClose={() => setConfirming(false)}>
          <p>{selected.size} dokumen dipilih. Server hanya menyetujui dokumen yang memenuhi syarat.</p>
          <div className="form-actions wrap">
            <button type="button" className="secondary" data-initial-focus onClick={() => setConfirming(false)}>Batal</button>
            <button type="button" onClick={() => void bulk()}>Setujui dokumen</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
