import { useSearchParams } from 'react-router-dom';
import AsyncState from '../../../components/AsyncState';
import ListPagination from '../../../components/ListPagination';
import ResponsiveList, { type ListColumn } from '../../../components/ResponsiveList';
import { toHakiError } from '../../../haki/api';
import { fmtDateTime } from '../../../haki/format';
import { readPage } from '../../../lib/pagination';
import { supabase } from '../../../lib/supabase';
import { useRemoteData } from '../../../lib/useRemoteData';

type Log = {
  id: number;
  actor: string | null;
  aksi: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};
const PAGE = 50;

// Log append-only. Admin melihat jejak aksi tanpa membuka isi dokumen.
export default function HakiAuditPage() {
  const [params, setParams] = useSearchParams();
  const action = params.get('aksi') ?? '';
  const page = readPage(params);
  const remote = useRemoteData(async () => {
    let query = supabase.from('audit_logs').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (action) query = query.ilike('aksi', action + '%');
    const { data, count, error } = await query;
    if (error) throw toHakiError(error);
    const rows = (data as Log[]) ?? [];
    const ids = [...new Set(rows.map((row) => row.actor).filter((id): id is string => !!id))];
    const emails: Record<string, string> = {};
    if (ids.length) {
      const { data, error } = await supabase.from('profiles').select('id, email').in('id', ids);
      if (error) throw toHakiError(error);
      for (const row of data ?? []) emails[row.id] = row.email ?? row.id;
    }
    return { rows, total: count ?? 0, emails };
  }, page + ':' + action);

  const columns: ListColumn<Log>[] = [
    { label: 'Aksi', render: (row) => row.aksi },
    { label: 'Waktu', render: (row) => fmtDateTime(row.created_at) },
    { label: 'Pelaku', render: (row) => row.actor ? remote.data?.emails[row.actor] ?? row.actor.slice(0, 8) : 'Sistem' },
    { label: 'Target', render: (row) => row.target_type ? row.target_type + ':' + (row.target_id ?? '').slice(0, 8) : '–' },
    { label: 'Detail', render: (row) => row.detail ? (
      <details><summary>Lihat detail</summary><code className="audit-payload mono small">{JSON.stringify(row.detail, null, 2)}</code></details>
    ) : '–' },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div><h1>Log Audit</h1><p className="muted">Jejak aktivitas dokumen dan pengelolaan sistem.</p></div>
      </header>
      <div className="table-toolbar">
        <label className="field">
          <span>Jenis aksi</span>
          <select value={action} onChange={(event) => setParams(event.target.value ? { aksi: event.target.value } : {})}>
            <option value="">Semua aksi</option>
            <option value="record.">Dokumen</option>
            <option value="persons.">Pencipta</option>
            <option value="file.">Berkas</option>
            <option value="export.">Ekspor</option>
            <option value="privacy.">Privasi</option>
            <option value="alias.">Alias</option>
          </select>
        </label>
      </div>
      <AsyncState loading={remote.loading} error={remote.error} onRetry={remote.retry} empty={remote.data?.rows.length === 0 ? 'Tidak ada entri untuk filter ini.' : undefined} />
      {remote.data && (
        <>
          <ResponsiveList rows={remote.data.rows} columns={columns} caption="Log audit" />
          <ListPagination total={remote.data.total} pageSize={PAGE} unit="entri" />
        </>
      )}
    </div>
  );
}
