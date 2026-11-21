import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AsyncState from '../../components/AsyncState';
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BulkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setSelected(new Set()); }, [rows]);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function bulk() {
    if (busy || !selected.size || selected.size > 100 || !confirm('Setujui ' + selected.size + ' dokumen? Server hanya menyetujui dokumen yang memenuhi syarat.')) return;
    setBusy(true);
    setError('');
    try {
      setResult(await rpc<BulkResult>('hki_bulk_approve', { p_ids: [...selected] }));
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
    { label: 'Jenis', render: (row) => row.jenis ? JENIS_LABEL[row.jenis] : '–' },
    { label: 'Dosen', render: (row) => row.owner_nama ?? '–' },
    { label: 'Unit', render: (row) => row.unit_nama ?? '–' },
    { label: 'Menunggu', render: (row) => row.submitted_at ? daysBetween(row.submitted_at) + ' hari' : '–' },
    { label: 'Keyakinan', render: (row) => row.min_confidence == null ? 'Tanpa skor AI' : Math.round(row.min_confidence * 100) + '%' },
  ];
  const selectAll = (
    <input type="checkbox" aria-label="Pilih semua dokumen pada halaman ini" disabled={busy}
      checked={rows.length > 0 && selected.size === rows.length}
      onChange={(event) => setSelected(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())} />
  );

  return (
    <div className="page">
      <h1>Antrean Validasi</h1>
      <p className="muted">Tinjau pengajuan dalam cakupan unit Anda.</p>
      <RecordFilters value={list.filters} units={list.units} master={list.master} fixedStatus="Menunggu validasi" showQueue onChange={list.updateFilters} />
      {error && <p className="error" role="alert">{error}</p>}
      {result && (
        <div className="notice" role="status">
          {result.approved.length} disetujui. {result.skipped.length} dilewati.
          {!!result.skipped.length && (
            <ul className="small">
              {result.skipped.map((item) => <li key={item.id}>{rows.find((row) => row.id === item.id)?.judul ?? item.id.slice(0, 8)} — {BULK_REASON[item.reason] ?? item.reason}</li>)}
            </ul>
          )}
        </div>
      )}
      <AsyncState loading={list.loading} error={list.error} onRetry={list.retry} empty={!rows.length ? 'Tidak ada pengajuan yang cocok.' : undefined} />
      {!list.loading && !list.error && <>
        {!!rows.length && (
          <div className="table-toolbar">
            <button onClick={() => void bulk()} disabled={busy || selected.size === 0}>Setujui terpilih ({selected.size})</button>
            <button className="secondary" disabled={busy} onClick={() => setSelected(new Set(rows.filter(quick).map((row) => row.id)))}>Pilih yang layak cepat</button>
            <label className="check mobile-select-all">{selectAll} Pilih semua</label>
          </div>
        )}
        <ResponsiveList
          rows={rows}
          columns={columns}
          caption="Antrean validasi"
          selectAll={selectAll}
          select={(row) => <input type="checkbox" aria-label={'Pilih ' + (row.judul || 'dokumen tanpa judul')}
            disabled={busy} checked={selected.has(row.id)} onChange={(event) => toggle(row.id, event.target.checked)} />}
        />
        <ListPagination total={list.total} pageSize={PAGE} unit="dokumen menunggu" />
      </>}
    </div>
  );
}
