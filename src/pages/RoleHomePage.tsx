import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth';
import AsyncState from '../components/AsyncState';
import StatusBadge from '../components/haki/StatusBadge';
import { fmtDate } from '../haki/format';
import type { HkiListRow, WorkflowStatus } from '../haki/types';
import { supabase } from '../lib/supabase';
import { roleLabel, type Role } from '../types';

type Destination = { to: string; label: string; description: string };
type Workspace = {
  primary: Destination;
  links: Destination[];
  records?: { title: string; statuses: WorkflowStatus[]; to: string };
};

const recap = { to: '/rekap-akademik', label: 'Rekap Akademik', description: 'Jumlah kegiatan berdasarkan tahun dan program studi.' };
const archive = { to: '/haki/arsip', label: 'Arsip HKI', description: 'Cari dan ekspor dokumen dalam cakupan akses Anda.' };
const dashboard = { to: '/haki/dashboard', label: 'Dashboard HKI', description: 'Lihat distribusi arsip dan ringkasan status.' };
const tasks: WorkflowStatus[] = ['DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED', 'CORRECTION_REQUESTED'];

const workspaces: Record<Role, Workspace> = {
  dosen: {
    primary: { to: '/haki/unggah', label: 'Unggah sertifikat', description: 'Mulai rekaman HKI dari sertifikat atau isi metadata secara manual.' },
    links: [
      { to: '/haki/saya', label: 'HKI Saya', description: 'Lanjutkan verifikasi, revisi, atau pengajuan dokumen.' },
      { to: '/penelitian', label: 'Penelitian', description: 'Kelola kegiatan penelitian dan anggota tim.' },
      recap,
    ],
    records: { title: 'HKI perlu tindakan', statuses: tasks, to: '/haki/saya' },
  },
  operator: {
    primary: { to: '/haki/unggah', label: 'Unggah atas nama dosen', description: 'Pilih dosen dalam unit Anda dan unggah sertifikatnya.' },
    links: [
      { to: '/haki/saya', label: 'Dokumen unit', description: 'Periksa dokumen dalam cakupan unit yang perlu disiapkan.' },
      archive,
      recap,
    ],
    records: { title: 'Pekerjaan unit', statuses: tasks, to: '/haki/saya' },
  },
  validator: {
    primary: { to: '/haki/antrean', label: 'Buka antrean validasi', description: 'Tinjau dokumen yang menunggu keputusan dalam cakupan unit Anda.' },
    links: [dashboard, archive, { to: '/haki/admin/master', label: 'Master HKI', description: 'Kelola jenis ciptaan dan sumber dana.' }],
    records: { title: 'Menunggu validasi', statuses: ['SUBMITTED'], to: '/haki/antrean' },
  },
  pemantau: {
    primary: { ...archive, label: 'Buka arsip HKI' },
    links: [dashboard, recap],
    records: { title: 'Arsip terbaru', statuses: ['ARCHIVED'], to: '/haki/arsip' },
  },
  admin: {
    primary: { to: '/pengguna', label: 'Kelola pengguna', description: 'Atur peran dan cakupan unit pengguna SISIDOS.' },
    links: [
      { to: '/unit', label: 'Unit', description: 'Kelola hierarki institusi dan program studi.' },
      { to: '/haki/admin/master', label: 'Master HKI', description: 'Kelola jenis ciptaan dan sumber dana.' },
      { to: '/haki/admin/ai', label: 'Konfigurasi AI', description: 'Kelola model, batas, dan statistik ekstraksi.' },
      { to: '/haki/admin/audit', label: 'Log Audit', description: 'Tinjau aktivitas sistem dan keputusan workflow.' },
    ],
  },
};

type HomeRecord = Pick<HkiListRow, 'id' | 'judul' | 'workflow_status' | 'updated_at'>;

export default function RoleHomePage() {
  const { role, dosen, dosen_id, email, unit } = useProfile();
  const workspace = workspaces[role];
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
      .select('id, judul, workflow_status, updated_at', { count: 'exact' })
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
      <header className="home-banner">
        <div>
          <p className="home-role">{roleLabel[role]}{unit?.nama ? ' · ' + unit.nama : ''}</p>
          <h1>Beranda</h1>
          <p className="home-name">{dosen?.nama ?? email ?? 'SISIDOS'}</p>
        </div>
        <div className="home-primary">
          <p>{workspace.primary.description}</p>
          <Link className="button-link" to={workspace.primary.to}>{workspace.primary.label} <span aria-hidden="true">›</span></Link>
        </div>
      </header>

      {section && (
        <section className="card home-work">
          <div className="card-head">
            <h2>{section.title}{count != null && !error ? <span className="home-count">{count}</span> : null}</h2>
            <Link to={section.to}>Lihat semua</Link>
          </div>
          <AsyncState error={error} loading={records === null} empty={records?.length === 0 ? 'Belum ada dokumen.' : undefined} onRetry={() => setReload((value) => value + 1)} />
          {records && records.length > 0 && (
            <ul className="home-records">
              {records.map((record) => (
                <li key={record.id}>
                  <Link to={'/haki/dokumen/' + record.id}>{record.judul || '(Tanpa judul)'}</Link>
                  <StatusBadge status={record.workflow_status} />
                  <time dateTime={record.updated_at}>{fmtDate(record.updated_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section aria-labelledby="home-access-title">
        <h2 id="home-access-title">Akses cepat</h2>
        <div className="home-links">
          {workspace.links.map((link) => (
            <Link className="card home-link" key={link.to} to={link.to}>
              <span className="home-link-label">{link.label} <span aria-hidden="true">›</span></span>
              <span className="muted">{link.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
