export type Prodi = {
  id: number;
  prodi: string;
};

export type Dosen = {
  id: number;
  nama: string;
  nidn: string;
  prodi_id: number | null;
  prodi?: Pick<Prodi, 'prodi'> | null;
};

export type KategoriPenelitian = {
  id: number;
  kategori_penelitian: string;
};

export type SubkategoriPenelitian = {
  id: number;
  sub_kategori_penelitian: string;
  kategori_penelitian_id: number;
  kategori_penelitian?: Pick<KategoriPenelitian, 'kategori_penelitian'> | null;
};

export type KategoriPengabdian = {
  id: number;
  kategori_pengabdian: string;
};

export type SubkategoriPengabdian = {
  id: number;
  sub_kategori_pengabdian: string;
  kategori_pengabdian_id: number;
  kategori_pengabdian?: Pick<KategoriPengabdian, 'kategori_pengabdian'> | null;
};

// Penelitian & pengabdian memakai tipe Kegiatan di src/components/KegiatanPage.tsx

export type Role = 'admin' | 'dosen' | 'pemantau' | 'validator' | 'operator';

export const roleLabel: Record<Role, string> = {
  admin: 'Admin',
  dosen: 'Dosen',
  validator: 'Validator HKI',
  operator: 'Operator',
  pemantau: 'Pemantau',
};

export type Unit = {
  id: number;
  nama: string;
  tipe: 'universitas' | 'fakultas' | 'prodi';
  parent_id: number | null;
  parent?: Pick<Unit, 'nama'> | null;
};

export type Profile = {
  id: string;
  email: string | null;
  role: Role;
  dosen_id: number | null;
  unit_id: number | null;
  privacy_notice_accepted_at: string | null;
  dosen?: Pick<Dosen, 'nama'> | null;
  unit?: Pick<Unit, 'nama'> | null;
};
