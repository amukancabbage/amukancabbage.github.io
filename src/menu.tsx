import type { ReactNode } from 'react';
import DosenPage from './pages/DosenPage';
import KategoriPenelitianPage from './pages/KategoriPenelitianPage';
import KategoriPengabdianPage from './pages/KategoriPengabdianPage';
import PenelitianPage from './pages/PenelitianPage';
import PengabdianPage from './pages/PengabdianPage';
import PenggunaPage from './pages/PenggunaPage';
import ProdiPage from './pages/ProdiPage';
import SubkategoriPenelitianPage from './pages/SubkategoriPenelitianPage';
import SubkategoriPengabdianPage from './pages/SubkategoriPengabdianPage';
import type { Role } from './types';

export type MenuItem = { path: string; label: string; element: ReactNode; roles: Role[] };
export type MenuGroup = { title: string; items: MenuItem[] };

const semua: Role[] = ['admin', 'dosen', 'pemantau'];
const admin: Role[] = ['admin'];

// Tambahkan halaman baru di sini; sidebar dan routing ikut otomatis.
// `roles` menentukan siapa saja yang bisa melihat menu tersebut.
export const menu: MenuGroup[] = [
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
    title: 'Master Data',
    items: [
      { path: '/dosen', label: 'Dosen', element: <DosenPage />, roles: admin },
      { path: '/prodi', label: 'Prodi', element: <ProdiPage />, roles: admin },
    ],
  },
  {
    title: 'Pengaturan',
    items: [{ path: '/pengguna', label: 'Pengguna', element: <PenggunaPage />, roles: admin }],
  },
];

// Menu yang boleh dilihat oleh role tertentu (grup kosong disembunyikan)
export function menuFor(role: Role): MenuGroup[] {
  return menu
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}
