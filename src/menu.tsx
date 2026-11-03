import type { ReactNode } from 'react';
import DosenPage from './pages/DosenPage';
import KategoriPenelitianPage from './pages/KategoriPenelitianPage';
import PenelitianPage from './pages/PenelitianPage';
import ProdiPage from './pages/ProdiPage';
import SubkategoriPenelitianPage from './pages/SubkategoriPenelitianPage';

export type MenuItem = { path: string; label: string; element: ReactNode };
export type MenuGroup = { title: string; items: MenuItem[] };

// Tambahkan halaman baru di sini; sidebar dan routing ikut otomatis
export const menu: MenuGroup[] = [
  {
    title: 'Master Data',
    items: [
      { path: '/dosen', label: 'Dosen', element: <DosenPage /> },
      { path: '/prodi', label: 'Prodi', element: <ProdiPage /> },
    ],
  },
  {
    title: 'Penelitian',
    items: [
      { path: '/penelitian', label: 'Data Penelitian', element: <PenelitianPage /> },
      { path: '/kategori-penelitian', label: 'Kategori', element: <KategoriPenelitianPage /> },
      { path: '/subkategori-penelitian', label: 'Subkategori', element: <SubkategoriPenelitianPage /> },
    ],
  },
];
