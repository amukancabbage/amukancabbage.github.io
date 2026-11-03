import CrudPage, { type Field } from '../components/CrudPage';
import type { SubkategoriPenelitian } from '../types';

const fields: Field<SubkategoriPenelitian>[] = [
  { name: 'sub_kategori_penelitian', label: 'Subkategori Penelitian', required: true },
  {
    name: 'kategori_penelitian_id',
    label: 'Kategori',
    type: 'select',
    required: true,
    source: {
      table: 'kategori_penelitian',
      select: 'id, kategori_penelitian',
      order: 'kategori_penelitian',
      label: (k) => k.kategori_penelitian,
    },
    render: (s) => s.kategori_penelitian?.kategori_penelitian ?? '-',
  },
];

export default function SubkategoriPenelitianPage() {
  return (
    <CrudPage<SubkategoriPenelitian>
      title="Subkategori Penelitian"
      table="subkategori_penelitian"
      select="id, sub_kategori_penelitian, kategori_penelitian_id, kategori_penelitian(kategori_penelitian)"
      fields={fields}
      pageSize={10}
    />
  );
}
