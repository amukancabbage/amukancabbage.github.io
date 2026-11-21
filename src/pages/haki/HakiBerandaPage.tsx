import { Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../auth';
import { IconLabel } from '../../components/AppIcon';
import AsyncState from '../../components/AsyncState';
import StatusBadge from '../../components/haki/StatusBadge';
import { rpc, toHakiError } from '../../haki/api';
import { fmtDate } from '../../haki/format';
import type { HkiListRow, Suggestion } from '../../haki/types';
import { supabase } from '../../lib/supabase';
import { useRemoteData } from '../../lib/useRemoteData';

const TODO = ['DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED', 'CORRECTION_REQUESTED'];

function Records({ title, rows, empty, operator }: { title: string; rows: HkiListRow[]; empty: string; operator: boolean }) {
  return (
    <section className="card home-work">
      <div className="card-head"><h2>{title}</h2></div>
      {!rows.length ? <p className="pad muted">{empty}</p> : (
        <ul className="home-records">
          {rows.map((row) => (
            <li key={row.id}>
              <div>
                <Link to={'/haki/dokumen/' + row.id}>{row.judul || '(Tanpa judul)'}</Link>
                {operator && <div className="muted small">{row.owner_nama}</div>}
              </div>
              <StatusBadge status={row.workflow_status} />
              <time dateTime={row.updated_at}>{fmtDate(row.updated_at)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function HakiBerandaPage() {
  const { role } = useProfile();
  const { data, error, loading, retry } = useRemoteData(async () => {
    await rpc('hki_sweep_stale').catch(() => undefined);
    const count = () => supabase.from('hki_record_list').select('id', { count: 'exact', head: true });
    const [todo, recent, all, archived, processing, suggestions] = await Promise.all([
      supabase.from('hki_record_list').select('*').in('workflow_status', TODO).order('updated_at', { ascending: false }).limit(10),
      supabase.from('hki_record_list').select('*').order('created_at', { ascending: false }).limit(5),
      count(),
      count().eq('workflow_status', 'ARCHIVED'),
      count().in('workflow_status', ['SUBMITTED', 'EXTRACTING']),
      role === 'dosen' ? rpc<Suggestion[]>('hki_my_suggestions') : Promise.resolve([]),
    ]);
    for (const result of [todo, recent, all, archived, processing]) if (result.error) throw toHakiError(result.error);
    return { todo: (todo.data as HkiListRow[]) ?? [], recent: (recent.data as HkiListRow[]) ?? [], all: all.count, archived: archived.count, processing: processing.count, suggestions };
  }, role);

  return (
    <div className="page">
      <header className="page-header">
        <div><h1>Ringkasan HKI</h1><p className="muted">Dokumen dan tugas dalam cakupan akses Anda.</p></div>
        <Link to="/haki/unggah" className="button-link"><IconLabel icon={Upload}>Unggah sertifikat</IconLabel></Link>
      </header>
      <AsyncState loading={loading} error={error} onRetry={retry} />
      {data && (
        <div className="stack">
          {!!data.suggestions.length && (
            <p className="notice">Ada {data.suggestions.length} dugaan kecocokan pencipta. <Link to="/haki/konfirmasi">Periksa kecocokan</Link></p>
          )}
          <div className="stats stats-3">
            {[['Semua dokumen', data.all], ['Sedang diproses', data.processing], ['Terarsip', data.archived]].map(([label, value]) => (
              <div className="stat" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value ?? '–'}</div></div>
            ))}
          </div>
          <Records title="Perlu tindakan" rows={data.todo} empty="Tidak ada tugas yang menunggu." operator={role === 'operator'} />
          <Records title="Dokumen terbaru" rows={data.recent} empty="Belum ada dokumen." operator={role === 'operator'} />
        </div>
      )}
    </div>
  );
}
