import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../auth';
import StatusBadge from '../../components/haki/StatusBadge';
import { rpc } from '../../haki/api';
import { JENIS_LABEL } from '../../haki/constants';
import { fmtDate } from '../../haki/format';
import type { HkiListRow, Suggestion } from '../../haki/types';
import { supabase } from '../../lib/supabase';

const TODO = ['DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED', 'CORRECTION_REQUESTED'];

export default function HakiBerandaPage() {
  const profile = useProfile();
  const [todo, setTodo] = useState<HkiListRow[]>([]);
  const [recent, setRecent] = useState<HkiListRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, arsip: 0, proses: 0 });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    (async () => {
      await rpc('hki_sweep_stale').catch(() => undefined);
      const [t, r, all] = await Promise.all([
        supabase.from('hki_record_list').select('*').in('workflow_status', TODO).order('updated_at', { ascending: false }).limit(10),
        supabase.from('hki_record_list').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('hki_record_list').select('workflow_status'),
      ]);
      setTodo((t.data as HkiListRow[]) ?? []);
      setRecent((r.data as HkiListRow[]) ?? []);
      const list = all.data ?? [];
      setCounts({
        total: list.length,
        arsip: list.filter((x) => x.workflow_status === 'ARCHIVED').length,
        proses: list.filter((x) => x.workflow_status === 'SUBMITTED' || x.workflow_status === 'EXTRACTING').length,
      });
      if (profile.role === 'dosen') setSuggestions(await rpc<Suggestion[]>('hki_my_suggestions').catch(() => []));
    })();
  }, [profile.role]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Beranda HAKI</h1>
          <p className="muted">Ringkasan dokumen hak kekayaan intelektual Anda.</p>
        </div>
        <Link to="/haki/unggah" className="button-link">
          Unggah sertifikat
        </Link>
      </div>

      {suggestions.length > 0 && (
        <div className="notice">
          Anda mungkin tercantum sebagai pencipta pada {suggestions.length} dokumen HKI.{' '}
          <Link to="/haki/konfirmasi">Konfirmasi sekarang</Link>
        </div>
      )}

      <div className="stats stats-3">
        <div className="stat">
          <div className="stat-label">Semua dokumen</div>
          <div className="stat-value">{counts.total}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Sedang diproses</div>
          <div className="stat-value">{counts.proses}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Terarsip</div>
          <div className="stat-value">{counts.arsip}</div>
        </div>
      </div>

      <h2 className="section-title">Perlu tindakan Anda</h2>
      <div className="card table-wrap">
        <table>
          <tbody>
            {todo.length === 0 ? (
              <tr>
                <td className="muted">Tidak ada tugas. Semua dokumen sudah beres.</td>
              </tr>
            ) : (
              todo.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/haki/dokumen/${r.id}`}>{r.judul || '(tanpa judul)'}</Link>
                    {profile.role === 'operator' && <div className="muted small">{r.owner_nama}</div>}
                  </td>
                  <td>
                    <StatusBadge status={r.workflow_status} />
                  </td>
                  <td className="muted">{fmtDate(r.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Terbaru</h2>
      <div className="card table-wrap">
        <table>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td className="muted">Belum ada dokumen.</td>
              </tr>
            ) : (
              recent.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/haki/dokumen/${r.id}`}>{r.judul || '(tanpa judul)'}</Link>
                  </td>
                  <td>{r.jenis ? JENIS_LABEL[r.jenis] : '-'}</td>
                  <td>
                    <StatusBadge status={r.workflow_status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
