import { Link } from 'react-router-dom';
import AsyncState from '../../components/AsyncState';
import { loadMaster, masterLabel, toHakiError } from '../../haki/api';
import { JENIS_LABEL, SOON_DAYS, WORKFLOW_LABEL } from '../../haki/constants';
import { daysBetween, daysUntil, fmtDate } from '../../haki/format';
import type { HkiListRow, WorkflowStatus } from '../../haki/types';
import { supabase } from '../../lib/supabase';
import { useRemoteData } from '../../lib/useRemoteData';

type Count = [string, number];

function tally<T>(rows: T[], key: (r: T) => string): Count[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Bars({ title, data }: { title: string; data: Count[] }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <div className="card pad">
      <h2>{title}</h2>
      {data.length === 0 ? (
        <p className="muted">Belum ada data.</p>
      ) : (
        <ul className="bars">
          {data.map(([label, n]) => (
            <li key={label}>
              <span className="bar-label">{label}</span>
              <span className="bar-track" aria-hidden="true">
                <span className="bar-fill" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="bar-value">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function HakiDashboardPage() {
  const remote = useRemoteData(async () => {
    const master = await loadMaster();
    const rows: HkiListRow[] = [];
    let total = 0;
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error, count } = await supabase
        .from('hki_record_list')
        .select('id, judul, jenis, tahun, unit_nama, sumber_dana, workflow_status, submitted_at, validated_at, berlaku_akhir, owner_nama', from === 0 ? { count: 'exact' } : undefined)
        .order('id')
        .range(from, from + 999);
      if (error) throw toHakiError(error);
      rows.push(...((data as HkiListRow[]) ?? []));
      total = count ?? total;
      if (!data || data.length < 1000) break;
    }
    return { rows, master, total };
  });

  if (!remote.data) return (
    <div className="page">
      <h1>Dashboard HKI</h1>
      <AsyncState error={remote.error} loading={remote.loading} onRetry={remote.retry} />
    </div>
  );
  const { rows, master, total } = remote.data;

  const archived = rows.filter((r) => r.workflow_status === 'ARCHIVED');
  const queue = rows.filter((r) => r.workflow_status === 'SUBMITTED');
  const validated = archived.filter((r) => r.submitted_at && r.validated_at);
  const avgDays = validated.length
    ? validated.reduce((s, r) => s + (new Date(r.validated_at!).getTime() - new Date(r.submitted_at!).getTime()) / 86400000, 0) / validated.length
    : null;
  const soon = archived
    .filter((r) => r.berlaku_akhir && daysUntil(r.berlaku_akhir) >= 0 && daysUntil(r.berlaku_akhir) <= SOON_DAYS)
    .sort((a, b) => a.berlaku_akhir!.localeCompare(b.berlaku_akhir!));
  const ages = [
    ['< 3 hari', queue.filter((r) => daysBetween(r.submitted_at!) < 3).length],
    ['3–7 hari', queue.filter((r) => daysBetween(r.submitted_at!) >= 3 && daysBetween(r.submitted_at!) < 7).length],
    ['7–14 hari', queue.filter((r) => daysBetween(r.submitted_at!) >= 7 && daysBetween(r.submitted_at!) < 14).length],
    ['≥ 14 hari', queue.filter((r) => daysBetween(r.submitted_at!) >= 14).length],
  ] as Count[];

  return (
    <div className="page">
      <h1>Dashboard HKI</h1>
      <p className="muted">Ringkasan dokumen dalam cakupan akses Anda. Statistik arsip memakai tahun tanggal permohonan.</p>
      {total > rows.length && <p className="notice">Grafik menampilkan {rows.length.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')} dokumen.</p>}
      {!rows.length && <AsyncState empty="Belum ada dokumen dalam cakupan akses Anda." />}
      <div className="stats stats-4">
        <div className="stat">
          <div className="stat-label">Terarsip</div>
          <div className="stat-value">{archived.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Menunggu validasi</div>
          <div className="stat-value">{queue.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Rata-rata hari validasi</div>
          <div className="stat-value">{avgDays == null ? '-' : avgDays.toFixed(1)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Segera berakhir (≤{SOON_DAYS} hari)</div>
          <div className="stat-value">{soon.length}</div>
        </div>
      </div>

      <div className="dash-grid">
        <Bars title="Per status dokumen" data={tally(rows, (r) => WORKFLOW_LABEL[r.workflow_status as WorkflowStatus])} />
        <Bars title="Umur antrean" data={queue.length ? ages : []} />
        <Bars title="Arsip per jenis" data={tally(archived, (r) => (r.jenis ? JENIS_LABEL[r.jenis] : 'Tanpa jenis'))} />
        <Bars title="Arsip per tahun" data={tally(archived, (r) => String(r.tahun ?? 'Tanpa tahun')).sort((a, b) => b[0].localeCompare(a[0]))} />
        <Bars title="Arsip per unit" data={tally(archived, (r) => r.unit_nama ?? 'Tanpa unit')} />
        <Bars title="Arsip per sumber dana" data={tally(archived, (r) => masterLabel(master, 'sumber_dana', r.sumber_dana) || 'Tidak diisi')} />
      </div>

      <h2 className="section-title">Segera berakhir</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Judul</th>
              <th>Jenis</th>
              <th>Pemilik</th>
              <th>Berlaku sampai</th>
            </tr>
          </thead>
          <tbody>
            {soon.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  Tidak ada.
                </td>
              </tr>
            ) : (
              soon.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/haki/dokumen/${r.id}`}>{r.judul || '(tanpa judul)'}</Link>
                  </td>
                  <td>{r.jenis ? JENIS_LABEL[r.jenis] : '-'}</td>
                  <td>{r.owner_nama}</td>
                  <td>
                    {fmtDate(r.berlaku_akhir)} ({daysUntil(r.berlaku_akhir!)} hari)
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
