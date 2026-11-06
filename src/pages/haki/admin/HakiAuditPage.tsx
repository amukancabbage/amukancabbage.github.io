import { useEffect, useState } from 'react';
import { fmtDateTime } from '../../../haki/format';
import { supabase } from '../../../lib/supabase';

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

// log append-only; admin melihat jejak aksi tanpa membuka isi dokumen
export default function HakiAuditPage() {
  const [rows, setRows] = useState<Log[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [aksi, setAksi] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (aksi) query = query.ilike('aksi', `${aksi}%`);
    query.then(async ({ data, count }) => {
      const list = (data as Log[]) ?? [];
      setRows(list);
      setTotal(count ?? 0);
      const ids = [...new Set(list.map((l) => l.actor).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', ids);
        setEmails(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.email ?? p.id])));
      }
    });
  }, [aksi, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="page">
      <h1>Log Audit</h1>
      <p className="muted">Jejak aksi tidak dapat diubah atau dihapus.</p>
      <div className="table-toolbar">
        <select
          value={aksi}
          onChange={(e) => {
            setAksi(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua aksi</option>
          <option value="record.">Dokumen</option>
          <option value="persons.">Pencipta</option>
          <option value="file.">Berkas</option>
          <option value="export.">Ekspor</option>
          <option value="privacy.">Privasi</option>
          <option value="alias.">Alias</option>
        </select>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Pelaku</th>
              <th>Aksi</th>
              <th>Target</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>{fmtDateTime(l.created_at)}</td>
                <td>{l.actor ? (emails[l.actor] ?? l.actor.slice(0, 8)) : 'sistem'}</td>
                <td>{l.aksi}</td>
                <td className="mono small">
                  {l.target_type ? `${l.target_type}:${(l.target_id ?? '').slice(0, 8)}` : '-'}
                </td>
                <td className="mono small">{l.detail ? JSON.stringify(l.detail) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>{total} entri</span>
        <div className="pagination-buttons">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ‹
          </button>
          <span className="page-info">
            {page} / {pages}
          </span>
          <button className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
