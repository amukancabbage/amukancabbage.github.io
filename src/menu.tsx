import {
  Archive, Bell, BookOpen, BriefcaseBusiness, Building2, ChartColumn, CircleHelp, ClipboardCheck, ClipboardList,
  Cog, Cpu, Database, FileCheck, FileText, FlaskConical, FolderOpen, GraduationCap, Handshake, House, IdCard,
  LayoutDashboard, ListTree, Tags, Upload, UserRoundCheck, Users, type LucideIcon,
} from 'lucide-react';
import { lazy, type ReactNode } from 'react';
import type { Role } from './types';

const RoleHomePage = lazy(() => import('./pages/RoleHomePage'));
const ArtikelMahasiswaPage = lazy(() => import('./pages/ArtikelMahasiswaPage'));
const BerandaPage = lazy(() => import('./pages/BerandaPage'));
const DosenPage = lazy(() => import('./pages/DosenPage'));
const KategoriPenelitianPage = lazy(() => import('./pages/KategoriPenelitianPage'));
const KategoriPengabdianPage = lazy(() => import('./pages/KategoriPengabdianPage'));
const PenelitianPage = lazy(() => import('./pages/PenelitianPage'));
const PengabdianPage = lazy(() => import('./pages/PengabdianPage'));
const PenggunaPage = lazy(() => import('./pages/PenggunaPage'));
const ProdiPage = lazy(() => import('./pages/ProdiPage'));
const SubkategoriPenelitianPage = lazy(() => import('./pages/SubkategoriPenelitianPage'));
const SubkategoriPengabdianPage = lazy(() => import('./pages/SubkategoriPengabdianPage'));
const UnitPage = lazy(() => import('./pages/UnitPage'));
const HakiAiPage = lazy(() => import('./pages/haki/admin/HakiAiPage'));
const HakiAuditPage = lazy(() => import('./pages/haki/admin/HakiAuditPage'));
const HakiMasterPage = lazy(() => import('./pages/haki/admin/HakiMasterPage'));
const HakiArchivePage = lazy(() => import('./pages/haki/HakiArchivePage'));
const HakiBerandaPage = lazy(() => import('./pages/haki/HakiBerandaPage'));
const HakiConfirmPage = lazy(() => import('./pages/haki/HakiConfirmPage'));
const HakiDashboardPage = lazy(() => import('./pages/haki/HakiDashboardPage'));
const HakiHelpPage = lazy(() => import('./pages/haki/HakiHelpPage'));
const HakiMinePage = lazy(() => import('./pages/haki/HakiMinePage'));
const HakiNotificationsPage = lazy(() => import('./pages/haki/HakiNotificationsPage'));
const HakiPortfolioPage = lazy(() => import('./pages/haki/HakiPortfolioPage'));
const HakiProfilePage = lazy(() => import('./pages/haki/HakiProfilePage'));
const HakiQueuePage = lazy(() => import('./pages/haki/HakiQueuePage'));
const HakiRecordPage = lazy(() => import('./pages/haki/HakiRecordPage'));
const HakiUploadPage = lazy(() => import('./pages/haki/HakiUploadPage'));

// `hidden`: rute terdaftar tetapi tidak tampil di sidebar (mis. detail dokumen)
export type MenuItem = { path: string; label: string; icon: LucideIcon; element: ReactNode; roles: Role[]; hidden?: boolean };
export type MenuGroup = { title: string; icon: LucideIcon; items: MenuItem[] };

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
    icon: House,
    items: [
      { path: '/beranda', label: 'Beranda', icon: House, element: <RoleHomePage />, roles: semua },
    ],
  },
  {
    title: 'Akademik',
    icon: GraduationCap,
    items: [
      { path: '/rekap-akademik', label: 'Rekap Akademik', icon: ChartColumn, element: <BerandaPage />, roles: semua },
      { path: '/penelitian', label: 'Data Penelitian', icon: FlaskConical, element: <PenelitianPage />, roles: semua },
      { path: '/pengabdian', label: 'Data Pengabdian', icon: Handshake, element: <PengabdianPage />, roles: semua },
      { path: '/artikel-mahasiswa', label: 'Artikel Mahasiswa', icon: BookOpen, element: <ArtikelMahasiswaPage />, roles: semua },
    ],
  },
  {
    title: 'HKI',
    icon: FileCheck,
    items: [
      { path: '/haki', label: 'Ringkasan HKI', icon: LayoutDashboard, element: <HakiBerandaPage />, roles: pengunggah },
      { path: '/haki/unggah', label: 'Unggah Sertifikat', icon: Upload, element: <HakiUploadPage />, roles: pengunggah },
      { path: '/haki/saya', label: 'HKI Saya', icon: FolderOpen, element: <HakiMinePage />, roles: pengunggah },
      { path: '/haki/konfirmasi', label: 'Konfirmasi Pencipta', icon: UserRoundCheck, element: <HakiConfirmPage />, roles: dosen },
      { path: '/haki/antrean', label: 'Antrean Validasi', icon: ClipboardCheck, element: <HakiQueuePage />, roles: validator },
      {
        path: '/haki/arsip',
        label: 'Arsip HKI',
        icon: Archive,
        element: <HakiArchivePage />,
        roles: ['dosen', 'operator', 'validator', 'pemantau'],
      },
      {
        path: '/haki/dashboard',
        label: 'Dashboard HKI',
        icon: ChartColumn,
        element: <HakiDashboardPage />,
        roles: ['validator', 'pemantau'],
      },
      { path: '/haki/portofolio', label: 'Portofolio', icon: BriefcaseBusiness, element: <HakiPortfolioPage />, roles: dosen },
      { path: '/haki/profil', label: 'Alias Nama', icon: IdCard, element: <HakiProfilePage />, roles: dosen },
      { path: '/haki/notifikasi', label: 'Notifikasi', icon: Bell, element: <HakiNotificationsPage />, roles: semua },
      { path: '/haki/bantuan', label: 'Bantuan HKI', icon: CircleHelp, element: <HakiHelpPage />, roles: semua },
      { path: '/haki/dokumen/:id', label: 'Dokumen HKI', icon: FileText, element: <HakiRecordPage />, roles: semua, hidden: true },
    ],
  },
  {
    title: 'Master Data',
    icon: Database,
    items: [
      { path: '/dosen', label: 'Dosen', icon: IdCard, element: <DosenPage />, roles: admin },
      { path: '/prodi', label: 'Prodi', icon: GraduationCap, element: <ProdiPage />, roles: admin },
      { path: '/unit', label: 'Unit', icon: Building2, element: <UnitPage />, roles: admin },
      { path: '/kategori-penelitian', label: 'Kategori Penelitian', icon: Tags, element: <KategoriPenelitianPage />, roles: admin },
      { path: '/subkategori-penelitian', label: 'Subkategori Penelitian', icon: ListTree, element: <SubkategoriPenelitianPage />, roles: admin },
      { path: '/kategori-pengabdian', label: 'Kategori Pengabdian', icon: Tags, element: <KategoriPengabdianPage />, roles: admin },
      { path: '/subkategori-pengabdian', label: 'Subkategori Pengabdian', icon: ListTree, element: <SubkategoriPengabdianPage />, roles: admin },
      { path: '/haki/admin/master', label: 'Master HKI', icon: Database, element: <HakiMasterPage />, roles: ['admin', 'validator'] },
    ],
  },
  {
    title: 'Pengaturan',
    icon: Cog,
    items: [
      { path: '/pengguna', label: 'Pengguna', icon: Users, element: <PenggunaPage />, roles: admin },
      { path: '/haki/admin/ai', label: 'Konfigurasi AI', icon: Cpu, element: <HakiAiPage />, roles: admin },
      { path: '/haki/admin/audit', label: 'Log Audit', icon: ClipboardList, element: <HakiAuditPage />, roles: admin },
    ],
  },
];

export const routeIcons = new Map(menu.flatMap((group) => group.items.map((item) => [item.path, item.icon] as const)));

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
