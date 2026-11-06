import type { ReactNode } from 'react';
import ArtikelMahasiswaPage from './pages/ArtikelMahasiswaPage';
import BerandaPage from './pages/BerandaPage';
import DosenPage from './pages/DosenPage';
import KategoriPenelitianPage from './pages/KategoriPenelitianPage';
import KategoriPengabdianPage from './pages/KategoriPengabdianPage';
import PenelitianPage from './pages/PenelitianPage';
import PengabdianPage from './pages/PengabdianPage';
import PenggunaPage from './pages/PenggunaPage';
import ProdiPage from './pages/ProdiPage';
import SubkategoriPenelitianPage from './pages/SubkategoriPenelitianPage';
import SubkategoriPengabdianPage from './pages/SubkategoriPengabdianPage';
import UnitPage from './pages/UnitPage';
import HakiAiPage from './pages/haki/admin/HakiAiPage';
import HakiAuditPage from './pages/haki/admin/HakiAuditPage';
import HakiMasterPage from './pages/haki/admin/HakiMasterPage';
import HakiArchivePage from './pages/haki/HakiArchivePage';
import HakiBerandaPage from './pages/haki/HakiBerandaPage';
import HakiConfirmPage from './pages/haki/HakiConfirmPage';
import HakiDashboardPage from './pages/haki/HakiDashboardPage';
import HakiHelpPage from './pages/haki/HakiHelpPage';
import HakiMinePage from './pages/haki/HakiMinePage';
import HakiNotificationsPage from './pages/haki/HakiNotificationsPage';
import HakiPortfolioPage from './pages/haki/HakiPortfolioPage';
import HakiProfilePage from './pages/haki/HakiProfilePage';
import HakiQueuePage from './pages/haki/HakiQueuePage';
import HakiRecordPage from './pages/haki/HakiRecordPage';
import HakiUploadPage from './pages/haki/HakiUploadPage';
import type { Role } from './types';

// `hidden`: rute terdaftar tetapi tidak tampil di sidebar (mis. detail dokumen)
export type MenuItem = { path: string; label: string; element: ReactNode; roles: Role[]; hidden?: boolean };
export type MenuGroup = { title: string; items: MenuItem[] };

const semua: Role[] = ['admin', 'dosen', 'pemantau', 'validator', 'operator'];
const admin: Role[] = ['admin'];
const pengunggah: Role[] = ['dosen', 'operator'];
const dosen: Role[] = ['dosen'];
const validator: Role[] = ['validator'];

// Tambahkan halaman baru di sini; sidebar dan routing ikut otomatis.
// `roles` menentukan siapa saja yang bisa melihat menu tersebut.
export const menu: MenuGroup[] = [
  {
    title: 'Utama',
    items: [{ path: '/beranda', label: 'Beranda', element: <BerandaPage />, roles: semua }],
  },
  {
    title: 'Penelitian',
    items: [
      { path: '/penelitian', label: 'Data Penelitian', element: <PenelitianPage />, roles: semua },
      { path: '/kategori-penelitian', label: 'Kategori', element: <KategoriPenelitianPage />, roles: admin },
      { path: '/subkategori-penelitian', label: 'Subkategori', element: <SubkategoriPenelitianPage />, roles: admin },
    ],
  },
  {
    title: 'Pengabdian',
    items: [
      { path: '/pengabdian', label: 'Data Pengabdian', element: <PengabdianPage />, roles: semua },
      { path: '/kategori-pengabdian', label: 'Kategori', element: <KategoriPengabdianPage />, roles: admin },
      { path: '/subkategori-pengabdian', label: 'Subkategori', element: <SubkategoriPengabdianPage />, roles: admin },
    ],
  },
  {
    title: 'Mahasiswa',
    items: [
      { path: '/artikel-mahasiswa', label: 'Artikel Mahasiswa', element: <ArtikelMahasiswaPage />, roles: semua },
    ],
  },
  {
    title: 'HAKI',
    items: [
      { path: '/haki', label: 'Beranda HAKI', element: <HakiBerandaPage />, roles: pengunggah },
      { path: '/haki/unggah', label: 'Unggah Sertifikat', element: <HakiUploadPage />, roles: pengunggah },
      { path: '/haki/saya', label: 'HKI Saya', element: <HakiMinePage />, roles: pengunggah },
      { path: '/haki/konfirmasi', label: 'Konfirmasi Pencipta', element: <HakiConfirmPage />, roles: dosen },
      { path: '/haki/antrean', label: 'Antrean Validasi', element: <HakiQueuePage />, roles: validator },
      {
        path: '/haki/arsip',
        label: 'Arsip HKI',
        element: <HakiArchivePage />,
        roles: ['dosen', 'operator', 'validator', 'pemantau'],
      },
      {
        path: '/haki/dashboard',
        label: 'Dashboard HKI',
        element: <HakiDashboardPage />,
        roles: ['validator', 'pemantau'],
      },
      { path: '/haki/portofolio', label: 'Portofolio', element: <HakiPortfolioPage />, roles: dosen },
      { path: '/haki/profil', label: 'Alias Nama', element: <HakiProfilePage />, roles: dosen },
      { path: '/haki/notifikasi', label: 'Notifikasi', element: <HakiNotificationsPage />, roles: semua },
      { path: '/haki/bantuan', label: 'Bantuan HAKI', element: <HakiHelpPage />, roles: semua },
      { path: '/haki/dokumen/:id', label: 'Dokumen HKI', element: <HakiRecordPage />, roles: semua, hidden: true },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { path: '/dosen', label: 'Dosen', element: <DosenPage />, roles: admin },
      { path: '/prodi', label: 'Prodi', element: <ProdiPage />, roles: admin },
      { path: '/unit', label: 'Unit', element: <UnitPage />, roles: admin },
      { path: '/haki/admin/master', label: 'Master HAKI', element: <HakiMasterPage />, roles: ['admin', 'validator'] },
    ],
  },
  {
    title: 'Pengaturan',
    items: [
      { path: '/pengguna', label: 'Pengguna', element: <PenggunaPage />, roles: admin },
      { path: '/haki/admin/ai', label: 'Konfigurasi AI HAKI', element: <HakiAiPage />, roles: admin },
      { path: '/haki/admin/audit', label: 'Log Audit', element: <HakiAuditPage />, roles: admin },
    ],
  },
];

// Menu yang boleh dibuka oleh role tertentu (grup kosong disembunyikan)
export function menuFor(role: Role): MenuGroup[] {
  return menu
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}

// Sama seperti menuFor, tanpa rute tersembunyi
export function sidebarFor(role: Role): MenuGroup[] {
  return menuFor(role)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.hidden) }))
    .filter((g) => g.items.length > 0);
}
