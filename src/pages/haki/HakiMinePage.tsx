import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProfile } from '../../auth';
import AsyncState from '../../components/AsyncState';
import ListPagination from '../../components/ListPagination';
import ResponsiveList, { type ListColumn } from '../../components/ResponsiveList';
import RecordFilters from '../../components/haki/RecordFilters';
import StatusBadge from '../../components/haki/StatusBadge';
import { errorText, rpc } from '../../haki/api';
import { DELETABLE, JENIS_LABEL, MINE_TABS } from '../../haki/constants';
import { fmtDate } from '../../haki/format';
import type { HkiListRow } from '../../haki/types';
import { useRecordList } from '../../haki/useRecordList';

const PAGE = 20;

export default function HakiMinePage() {
  const profile = useProfile();
  const { pathname, search } = useLocation();
  const list = useRecordList('mine', PAGE);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const operator = profile.role === 'operator';

  async function remove(row: HkiListRow) {
    if (deleting || !confirm('Hapus dokumen “' + (row.judul ?? 'tanpa judul') + '”?')) return;
    setDeleting(row.id);
    setError('');
    try {
      await rpc('hki_delete_record', { p_record: row.id });
      list.retry();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setDeleting(null);
    }
  }

  const columns: ListColumn<HkiListRow>[] = [
    { label: 'Judul', render: (row) => <Link to={'/haki/dokumen/' + row.id} state={{ from: pathname + search }}>{row.judul || '(Tanpa judul)'}</Link> },
    { label: 'Jenis', render: (row) => row.jenis ? JENIS_LABEL[row.jenis] : '–' },
    { label: 'Tahun', render: (row) => row.tahun ?? '–' },
    ...(operator ? [{ label: 'Dosen', render: (row: HkiListRow) => row.owner_nama ?? '–' }] : []),
    { label: 'Status', render: (row) => <StatusBadge status={row.workflow_status} /> },
    { label: 'Diperbarui', render: (row) => fmtDate(row.updated_at) },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div><h1>HKI Saya</h1><p className="muted">{operator ? 'Dokumen dosen dalam unit Anda.' : 'Dokumen milik Anda dan dokumen yang Anda konfirmasi sebagai pencipta.'}</p></div>
        <Link to="/haki/unggah" className="button-link">Unggah sertifikat</Link>
      </header>
      <RecordFilters value={list.filters} units={list.units} master={list.master} showStatus statusChoices={MINE_TABS.filter((tab) => tab.key !== 'semua')} onChange={list.updateFilters} />
      {error && <p className="error" role="alert">{error}</p>}
      <AsyncState loading={list.loading} error={list.error} onRetry={list.retry} empty={!list.rows.length ? 'Tidak ada dokumen yang cocok.' : undefined} />
      {!list.loading && !list.error && <>
        <ResponsiveList
          rows={list.rows}
          columns={columns}
          caption="Dokumen HKI"
          actions={(row) => DELETABLE.includes(row.workflow_status) && (row.owner_dosen_id === profile.dosen_id || operator) ? (
            <button className="danger" disabled={deleting !== null} onClick={() => void remove(row)}>Hapus</button>
          ) : null}
        />
        <ListPagination total={list.total} pageSize={PAGE} />
      </>}
    </div>
  );
}
