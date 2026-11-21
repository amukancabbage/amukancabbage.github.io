import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth';
import AppIcon, { IconLabel } from '../components/AppIcon';
import AsyncState from '../components/AsyncState';
import StatusBadge from '../components/haki/StatusBadge';
import { fmtDate } from '../haki/format';
import type { HkiListRow, WorkflowStatus } from '../haki/types';
import { supabase } from '../lib/supabase';
import { routeIcons } from '../menu';
import { roleLabel, type Role } from '../types';

type Destination = { to: string; label: string; description: string };
type Workspace = {
  primary: Pick<Destination, 'to' | 'label'>;
  links: Destination[];
  records?: { title: string; statuses: WorkflowStatus[]; to: string };
};

const recap = { to: '/rekap-akademik', label: 'Rekap Akademik', description: 'Jumlah kegiatan berdasarkan tahun dan program studi.' };
const archive = { to: '/haki/arsip', label: 'Arsip HKI', description: 'Cari dan ekspor dokumen dalam cakupan akses Anda.' };
const dashboard = { to: '/haki/dashboard', label: 'Dashboard HKI', description: 'Lihat distribusi arsip dan ringkasan status.' };
const tasks: WorkflowStatus[] = ['DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED', 'CORRECTION_REQUESTED'];

const workspaces: Record<Role, Workspace> = {
  dosen: {
    primary: { to: '/haki/unggah', label: 'Unggah sertifikat' },
    links: [
      { to: '/haki/saya', label: 'HKI Saya', description: 'Lanjutkan verifikasi, revisi, atau pengajuan dokumen.' },
      { to: '/penelitian', label: 'Penelitian', description: 'Kelola kegiatan penelitian dan anggota tim.' },
      recap,
    ],
    records: { title: 'HKI perlu tindakan', statuses: tasks, to: '/haki/saya' },
  },
  operator: {
    primary: { to: '/haki/unggah', label: 'Unggah atas nama dosen' },
    links: [
      { to: '/haki/saya', label: 'Dokumen unit', description: 'Periksa dokumen dalam cakupan unit yang perlu disiapkan.' },
      archive,
      recap,
    ],
    records: { title: 'Pekerjaan unit', statuses: tasks, to: '/haki/saya' },
  },
  validator: {
    primary: { to: '/haki/antrean', label: 'Buka antrean validasi' },
    links: [dashboard, archive, { to: '/haki/admin/master', label: 'Master HKI', description: 'Kelola jenis ciptaan dan sumber dana.' }],
    records: { title: 'Menunggu validasi', statuses: ['SUBMITTED'], to: '/haki/antrean' },
  },
  pemantau: {
    primary: { to: archive.to, label: 'Buka arsip HKI' },
    links: [dashboard, recap],
    records: { title: 'Arsip terbaru', statuses: ['ARCHIVED'], to: '/haki/arsip' },
  },
  admin: {
    primary: { to: '/pengguna', label: 'Kelola pengguna' },
    links: [
      { to: '/unit', label: 'Unit', description: 'Kelola hierarki institusi dan program studi.' },
      { to: '/haki/admin/master', label: 'Master HKI', description: 'Kelola jenis ciptaan dan sumber dana.' },
      { to: '/haki/admin/ai', label: 'Konfigurasi AI', description: 'Kelola model, batas, dan statistik ekstraksi.' },
      { to: '/haki/admin/audit', label: 'Log Audit', description: 'Tinjau aktivitas sistem dan keputusan workflow.' },
    ],
  },
};

type HomeRecord = Pick<HkiListRow, 'id' | 'judul' | 'workflow_status' | 'updated_at' | 'submitted_at'>;

export default function RoleHomePage() {
  const { role, dosen_id, unit } = useProfile();
  const workspace = workspaces[role];
  const primaryIcon = routeIcons.get(workspace.primary.to);
  const section = workspace.records;
  const [records, setRecords] = useState<HomeRecord[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!section) return;
    let alive = true;
    setRecords(null);
    setError('');
    let query = supabase.from('hki_record_list')
      .select('id, judul, workflow_status, updated_at, submitted_at', { count: 'exact' })
      .in('workflow_status', section.statuses)
      .order(role === 'validator' ? 'submitted_at' : 'updated_at', { ascending: role === 'validator' })
      .order('id')
      .limit(5);
    if (role === 'dosen') {
      if (dosen_id == null) { setRecords([]); setCount(0); return; }
      query = query.eq('owner_dosen_id', dosen_id);
    }
    void query.then(({ data, error, count }) => {
      if (!alive) return;
      setError(error ? 'Daftar dokumen gagal dimuat.' : '');
      setRecords((data as HomeRecord[] | null) ?? []);
      setCount(count);
    });
    return () => { alive = false; };
  }, [section, role, dosen_id, reload]);

  return (
    <div className="page home-page">
      <header className="page-header home-heading">
        <div>
          <h1>Beranda</h1>
          <p className="muted">{roleLabel[role]}{unit?.nama ? ` (${unit.nama})` : ''}</p>
        </div>
        <Link className="button-link" to={workspace.primary.to}>
          {primaryIcon ? <IconLabel icon={primaryIcon}>{workspace.primary.label}</IconLabel> : workspace.primary.label}
        </Link>
      </header>

      <div className={'home-body tw:grid tw:items-start tw:gap-6' + (section ? ' has-work' : '')}>
        {section && (
          <section className="card home-work">
            <div className="card-head">
              <div className="tw:flex tw:flex-wrap tw:items-baseline tw:gap-x-3">
                <h2>{section.title}</h2>
                {count != null && !error && records !== null && (
                  <span className="muted small">{count.toLocaleString('id-ID')} dokumen</span>
                )}
              </div>
              {section.to !== workspace.primary.to && <Link to={section.to}>Lihat semua</Link>}
            </div>
            <AsyncState error={error} loading={records === null} empty={records?.length === 0 ? 'Belum ada dokumen.' : undefined} onRetry={() => setReload((value) => value + 1)} />
            {records && records.length > 0 && (
              <ul className="home-records tw:m-0 tw:list-none tw:p-0">
                {records.map((record) => {
                  const submittedAt = role === 'validator' ? record.submitted_at : null;
                  return (
                    <li key={record.id}>
                      <Link to={'/haki/dokumen/' + record.id}>{record.judul || '(Tanpa judul)'}</Link>
                      <StatusBadge status={record.workflow_status} />
                      <time dateTime={submittedAt ?? record.updated_at}>{submittedAt ? 'Diajukan ' : ''}{fmtDate(submittedAt ?? record.updated_at)}</time>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
        <section aria-labelledby="home-access-title">
          <h2 id="home-access-title">{role === 'admin' ? 'Pengelolaan sistem' : 'Akses cepat'}</h2>
          <ul className="home-links tw:m-0 tw:grid tw:list-none tw:p-0">
            {workspace.links.map((link) => {
              const icon = routeIcons.get(link.to);
              return (
                <li className="tw:min-w-0 tw:bg-surface" key={link.to}>
                  <Link className="home-link tw:flex tw:items-start tw:gap-3" to={link.to}>
                    {icon && <AppIcon icon={icon} className="home-link-icon tw:mt-1" />}
                    <span className="tw:min-w-0 tw:flex-1">
                      <span className="home-link-label tw:block">{link.label}</span>
                      <span className="muted small tw:block">{link.description}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
