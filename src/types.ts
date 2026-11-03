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
  dosen_id: number;
  sub_kategori_penelitian_id: number;
  judul_penelitian: string;
  tahun: number;
  publikasi: string | null;
  url_bukti: string | null;
  url_dokumen: string | null;
  keterangan: string | null;
  dosen?: Pick<Dosen, 'nama'> | null;
  subkategori_penelitian?: Pick<SubkategoriPenelitian, 'sub_kategori_penelitian' | 'kategori_penelitian'> | null;
};
