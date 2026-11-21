import { Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProfile } from '../../auth';
import { IconLabel } from '../../components/AppIcon';
import AsyncState from '../../components/AsyncState';
import DeleteDialog from '../../components/DeleteDialog';
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
  const [deleting, setDeleting] = useState<HkiListRow | null>(null);
  const operator = profile.role === 'operator';

  async function remove(row: HkiListRow) {
    try {
      await rpc('hki_delete_record', { p_record: row.id });
      list.retry();
    } catch (e) {
      throw new Error(errorText(e));
    }
  }

  const columns: ListColumn<HkiListRow>[] = [
    { id: 'judul', label: 'Judul', render: (row) => <Link to={'/haki/dokumen/' + row.id} state={{ from: pathname + search }}>{row.judul || '(Tanpa judul)'}</Link> },
    { label: 'Status', render: (row) => <StatusBadge status={row.workflow_status} /> },
    ...(operator ? [{ label: 'Dosen', render: (row: HkiListRow) => row.owner_nama ?? '–' }] : []),
    { id: 'updated_at', label: 'Diperbarui', render: (row) => fmtDate(row.updated_at) },
    { label: 'Jenis', visibility: 'desktop', render: (row) => row.jenis ? JENIS_LABEL[row.jenis] : '–' },
    { label: 'Tahun', visibility: 'detail', render: (row) => row.tahun ?? '–' },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div><h1>HKI Saya</h1><p className="muted">{operator ? 'Dokumen dosen dalam cakupan unit Anda.' : 'Dokumen milik Anda dan dokumen yang Anda konfirmasi sebagai pencipta.'}</p></div>
        <Link to="/haki/unggah" className="button-link"><IconLabel icon={Upload}>Unggah sertifikat</IconLabel></Link>
      </header>
      <RecordFilters value={list.filters} units={list.units} master={list.master} pager={list.pager} showStatus statusChoices={MINE_TABS.filter((tab) => tab.key !== 'semua')} onChange={list.updateFilters} />
      <AsyncState loading={list.loading} error={list.error} onRetry={list.retry} empty={!list.rows.length ? 'Tidak ada dokumen yang cocok.' : undefined} />
      <ResponsiveList
          rows={list.rows}
          columns={columns}
          caption="Dokumen HKI"
          list={list.pager} total={list.total} pending={list.loading} failed={!!list.error} order={list.order}
          detailActions={(row) => DELETABLE.includes(row.workflow_status) && (row.owner_dosen_id === profile.dosen_id || operator) ? (
            <button className="danger" onClick={() => setDeleting(row)}><IconLabel icon={Trash2}>Hapus</IconLabel></button>
          ) : null}
      />
      {deleting && <DeleteDialog name={deleting.judul || 'dokumen tanpa judul'} remove={() => remove(deleting)} onClose={() => setDeleting(null)} />}
    </div>
  );
}
