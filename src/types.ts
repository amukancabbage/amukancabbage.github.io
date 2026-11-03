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

export type Penelitian = {
  id: number;
  // ketua: salah satu dari dosen_id (daftar dosen) atau ketua_luar (nama bebas)
  dosen_id: number | null;
  ketua_luar: string | null;
  sub_kategori_penelitian_id: number;
  judul_penelitian: string;
  tahun: number;
  publikasi: string | null;
  url_bukti: string | null;
  url_dokumen: string | null;
  keterangan: string | null;
  // akun yang menginput (auth.users.id)
  created_by: string | null;
  dosen?: Pick<Dosen, 'nama'> | null;
  penelitian_anggota?: { dosen_id: number; dosen: Pick<Dosen, 'nama'> | null }[];
  subkategori_penelitian?: Pick<SubkategoriPenelitian, 'sub_kategori_penelitian' | 'kategori_penelitian'> | null;
};

export type Role = 'admin' | 'dosen' | 'pemantau';

export type Profile = {
  id: string;
  email: string | null;
  role: Role;
  dosen_id: number | null;
  dosen?: Pick<Dosen, 'nama'> | null;
};
