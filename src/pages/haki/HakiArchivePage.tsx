import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProfile } from '../../auth';
import AsyncState from '../../components/AsyncState';
import ListPagination from '../../components/ListPagination';
import ResponsiveList, { type ListColumn } from '../../components/ResponsiveList';
import RecordFilters from '../../components/haki/RecordFilters';
import StatusBadge from '../../components/haki/StatusBadge';
import { errorText, masterLabel } from '../../haki/api';
import { EXPORT_MAX_ROWS, EXPORT_MAX_ZIP, JENIS_LABEL } from '../../haki/constants';
import { fmtDate } from '../../haki/format';
import type { HkiListRow } from '../../haki/types';
import { useRecordList } from '../../haki/useRecordList';

const PAGE = 25;

export default function HakiArchivePage() {
  const profile = useProfile();
  const { pathname, search } = useLocation();
  // validator/operator dapat melihat semua status dalam cakupan; selainnya hanya arsip
  const allStatuses = profile.role === 'validator' || profile.role === 'operator';
  const list = useRecordList('archive', PAGE, allStatuses);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function exportAs(kind: 'csv' | 'xlsx' | 'zip') {
    if (busy || list.error || !list.settings) return;
    setBusy(kind.toUpperCase());
    setError('');
    try {
      const { csv, fetchAll, logExport, saveBlob, toRows, xlsx, zipFiles } = await import('../../haki/export');
      const all = await fetchAll((from, to) => list.query(false)!.range(from, to));
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'csv') saveBlob(csv(toRows(all, list.master)), 'arsip-hki-' + stamp + '.csv');
      if (kind === 'xlsx') saveBlob(xlsx(toRows(all, list.master)), 'arsip-hki-' + stamp + '.xlsx');
      if (kind === 'zip') saveBlob(await zipFiles(all, list.master, (done, total) => setBusy('ZIP ' + done + '/' + total)), 'arsip-hki-' + stamp + '.zip');
      await logExport(kind, all.length);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const columns: ListColumn<HkiListRow>[] = [
    { label: 'Judul', render: (row) => <Link to={'/haki/dokumen/' + row.id} state={{ from: pathname + search }}>{row.judul || '(Tanpa judul)'}</Link> },
    { label: 'No. sertifikat', render: (row) => row.no_sertifikat ?? '–' },
    { label: 'Status', render: (row) => <StatusBadge status={row.workflow_status} /> },
    { label: 'Pencipta', visibility: 'desktop', render: (row) => row.pencipta ?? '–' },
    { label: 'Unit', visibility: 'desktop', render: (row) => row.unit_nama ?? '–' },
    { label: 'Jenis', visibility: 'detail', render: (row) => row.jenis ? JENIS_LABEL[row.jenis] : '–' },
    { label: 'Tgl. permohonan', visibility: 'detail', render: (row) => fmtDate(row.tgl_permohonan) },
    { label: 'Sumber dana', visibility: 'detail', render: (row) => masterLabel(list.master, 'sumber_dana', row.sumber_dana) || '–' },
  ];
  const exportDisabled = !!busy || list.loading || !!list.error || list.total === 0;

  return (
    <div className="page">
      <header className="page-header">
        <div><h1>Arsip HKI</h1><p className="muted">Cari dan ekspor dokumen dalam cakupan akses Anda. Tahun diambil dari tanggal permohonan.</p></div>
        <details className="actions-disclosure export-actions">
          <summary>Ekspor</summary>
          <div className="actions" aria-label="Ekspor arsip">
            <button className="secondary" onClick={() => void exportAs('csv')} disabled={exportDisabled}>CSV</button>
            <button className="secondary" onClick={() => void exportAs('xlsx')} disabled={exportDisabled}>XLSX</button>
            <button className="secondary" onClick={() => void exportAs('zip')} disabled={exportDisabled || list.total > EXPORT_MAX_ZIP}>ZIP berkas</button>
          </div>
        </details>
      </header>
      {busy && <p className="notice" role="status">Menyiapkan ekspor {busy}…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {list.total > EXPORT_MAX_ZIP && <p className="muted small">Persempit filter untuk ZIP hingga {EXPORT_MAX_ZIP} dokumen.</p>}
      {list.total > EXPORT_MAX_ROWS && <p className="muted small">CSV dan XLSX memuat hingga {EXPORT_MAX_ROWS} baris pertama.</p>}
      <RecordFilters value={list.filters} units={list.units} master={list.master} total={list.loading || list.error ? null : list.total} showStatus={allStatuses} defaultStatusLabel="Terarsip (bawaan)" fixedStatus={allStatuses ? undefined : 'Terarsip'} onChange={list.updateFilters} />
      <AsyncState error={list.error} loading={list.loading} empty={!list.rows.length ? 'Tidak ada dokumen yang cocok.' : undefined} onRetry={list.retry} />
      {!list.loading && !list.error && <>
        <ResponsiveList rows={list.rows} columns={columns} caption="Arsip HKI" />
        <ListPagination total={list.total} pageSize={PAGE} showTotal={false} />
      </>}
    </div>
  );
}
