import CrudPage, { type Field } from '../components/CrudPage';
import type { KategoriPenelitian } from '../types';

const fields: Field<KategoriPenelitian>[] = [
  { name: 'kategori_penelitian', label: 'Kategori Penelitian', required: true },
];

export default function KategoriPenelitianPage() {
  return (
    <CrudPage<KategoriPenelitian>
      title="Kategori Penelitian"
      table="kategori_penelitian"
      select="id, kategori_penelitian"
      fields={fields}
    />
  );
}
