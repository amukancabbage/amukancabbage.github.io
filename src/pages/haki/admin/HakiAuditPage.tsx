import { useEffect, useState } from 'react';
import AsyncState from '../../../components/AsyncState';
import ListSort from '../../../components/ListSort';
import ResponsiveList, { type ListColumn } from '../../../components/ResponsiveList';
import { toHakiError } from '../../../haki/api';
import { fmtDateTime } from '../../../haki/format';
import { readListPage, readListSort, useListParams, type ListSorts } from '../../../lib/pagination';
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
const sorts: ListSorts = { waktu: { column: 'created_at', label: 'Waktu', ascending: false, chronological: true } };

// Log append-only. Admin melihat jejak aksi tanpa membuka isi dokumen.
export default function HakiAuditPage() {
  const list = useListParams(PAGE);
  const { page, pageSize } = list;
  const action = list.params.get('aksi') ?? '';
  const order = readListSort(list.params, sorts) ?? sorts.waktu;
  const key = list.params.toString();
  const [total, setTotal] = useState(0);
  const remote = useRemoteData(async () => {
    function query(head = false) {
      let request = supabase.from('audit_logs').select(head ? 'id' : '*', { count: 'exact', head })
        .order(order.column, { ascending: order.ascending }).order('id', { ascending: false });
      if (action) request = request.ilike('aksi', action + '%');
      return request;
    }
    const result = await readListPage<Log>(page, pageSize, (from, to) => query().range(from, to), () => query(true))
      .catch((error) => { throw toHakiError(error); });
    const ids = [...new Set(result.rows.map((row) => row.actor).filter((id): id is string => !!id))];
    const emails: Record<string, string> = {};
    if (ids.length) {
      const { data, error } = await supabase.from('profiles').select('id, email').in('id', ids);
      if (error) throw toHakiError(error);
      for (const row of data ?? []) emails[row.id] = row.email ?? row.id;
    }
    return { ...result, key, emails };
  }, key);

  useEffect(() => {
    if (!remote.data || remote.data.key !== key) return;
    setTotal(remote.data.total);
    if (remote.data.page !== page) list.setPage(remote.data.page, true);
  }, [remote.data, key, page, list]);
  const pending = !remote.error && (remote.data?.key !== key || remote.data?.page !== page);

  const columns: ListColumn<Log>[] = [
    { label: 'Aksi', render: (row) => row.aksi },
    { id: 'created_at', label: 'Waktu', render: (row) => fmtDateTime(row.created_at) },
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
          <select value={action} onChange={(event) => list.update({ aksi: event.target.value })}>
            <option value="">Semua aksi</option>
            <option value="record.">Dokumen</option>
            <option value="persons.">Pencipta</option>
            <option value="file.">Berkas</option>
            <option value="export.">Ekspor</option>
            <option value="privacy.">Privasi</option>
            <option value="alias.">Alias</option>
          </select>
        </label>
        <ListSort list={list} choices={sorts} />
      </div>
      <AsyncState loading={pending} error={remote.error} onRetry={remote.retry} empty={remote.data?.rows.length === 0 ? 'Tidak ada entri untuk filter ini.' : undefined} />
      <ResponsiveList rows={remote.data?.rows ?? []} columns={columns} caption="Log audit"
        list={list} total={total} order={order} pending={pending} failed={!!remote.error} />
    </div>
  );
}
