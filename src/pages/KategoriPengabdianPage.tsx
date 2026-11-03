import CrudPage, { type Field } from '../components/CrudPage';
import type { KategoriPengabdian } from '../types';

const fields: Field<KategoriPengabdian>[] = [
  { name: 'kategori_pengabdian', label: 'Kategori Pengabdian', required: true },
];

export default function KategoriPengabdianPage() {
  return (
    <CrudPage<KategoriPengabdian>
      title="Kategori Pengabdian"
      table="kategori_pengabdian"
      select="id, kategori_pengabdian"
      fields={fields}
    />
  );
}
