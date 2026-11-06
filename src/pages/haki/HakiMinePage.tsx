import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../auth';
import StatusBadge from '../../components/haki/StatusBadge';
import { errorText, rpc } from '../../haki/api';
import { DELETABLE, JENIS_LABEL, MINE_TABS } from '../../haki/constants';
import { fmtDate } from '../../haki/format';
import type { HkiListRow } from '../../haki/types';
import { supabase } from '../../lib/supabase';

const PAGE = 20;

export default function HakiMinePage() {
  const profile = useProfile();
  const [tab, setTab] = useState('semua');
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const [rows, setRows] = useState<HkiListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await rpc('hki_sweep_stale').catch(() => undefined);
      let query = supabase
        .from('hki_record_list')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range((page - 1) * PAGE, page * PAGE - 1);
      const statuses = MINE_TABS.find((t) => t.key === tab)?.statuses;
      if (statuses) query = query.in('workflow_status', statuses);
      if (applied) query = query.ilike('judul', `%${applied}%`);
      const { data, count, error: err } = await query;
      if (!alive) return;
      if (err) setError(err.message);
      setRows((data as HkiListRow[]) ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [tab, applied, page, reload]);

  // dokumen sedang dibaca AI: segarkan berkala
  useEffect(() => {
    if (!rows.some((r) => r.workflow_status === 'EXTRACTING')) return;
    const t = window.setTimeout(() => setReload((n) => n + 1), 10000);
    return () => window.clearTimeout(t);
  }, [rows]);

  async function remove(row: HkiListRow) {
    if (!confirm(`Hapus dokumen "${row.judul ?? 'tanpa judul'}"?`)) return;
    try {
      await rpc('hki_delete_record', { p_record: row.id });
      setReload((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>HKI Saya</h1>
          <p className="muted">
            {profile.role === 'operator'
              ? 'Dokumen HKI dosen di unit Anda.'
              : 'Dokumen HKI milik Anda dan yang Anda konfirmasi sebagai pencipta.'}
          </p>
        </div>
        <Link to="/haki/unggah" className="button-link">
          Unggah sertifikat
        </Link>
      </div>

      <div className="tabs" role="tablist">
        {MINE_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? '' : 'secondary'}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        className="table-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(q.trim());
          setPage(1);
        }}
      >
        <input className="search-input" placeholder="Cari judul..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="secondary">
          Cari
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Judul</th>
              <th>Jenis</th>
              <th>Tahun</th>
              {profile.role === 'operator' && <th>Dosen</th>}
              <th>Status</th>
              <th>Diperbarui</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>Memuat...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  Belum ada dokumen.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/haki/dokumen/${r.id}`}>{r.judul || '(tanpa judul)'}</Link>
                  </td>
                  <td>{r.jenis ? JENIS_LABEL[r.jenis] : '-'}</td>
                  <td>{r.tahun ?? '-'}</td>
                  {profile.role === 'operator' && <td>{r.owner_nama}</td>}
                  <td>
                    <StatusBadge status={r.workflow_status} />
                  </td>
                  <td>{fmtDate(r.updated_at)}</td>
                  <td className="actions">
                    {DELETABLE.includes(r.workflow_status) &&
                      (r.owner_dosen_id === profile.dosen_id || profile.role === 'operator') && (
                        <button className="danger" onClick={() => remove(r)}>
                          Hapus
                        </button>
                      )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>{total} dokumen</span>
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
