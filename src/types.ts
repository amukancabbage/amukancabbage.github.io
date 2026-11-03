export type Prodi = {
  id: number;
  prodi: string;
};

export type Dosen = {
  id: number;
  nama: string;
  nidn: string;
  prodi_id: number | null;
  prodi?: Pick<Prodi, 'id' | 'prodi'> | null;
};
