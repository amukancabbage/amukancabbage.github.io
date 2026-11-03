import CrudPage, { type Field } from '../components/CrudPage';
import type { SubkategoriPengabdian } from '../types';

const fields: Field<SubkategoriPengabdian>[] = [
  { name: 'sub_kategori_pengabdian', label: 'Subkategori Pengabdian', required: true },
  {
    name: 'kategori_pengabdian_id',
    label: 'Kategori',
    type: 'select',
    required: true,
    source: {
      table: 'kategori_pengabdian',
      select: 'id, kategori_pengabdian',
      order: 'kategori_pengabdian',
      label: (k) => k.kategori_pengabdian,
    },
    render: (s) => s.kategori_pengabdian?.kategori_pengabdian ?? '-',
  },
];

export default function SubkategoriPengabdianPage() {
  return (
    <CrudPage<SubkategoriPengabdian>
      title="Subkategori Pengabdian"
      table="subkategori_pengabdian"
      select="id, sub_kategori_pengabdian, kategori_pengabdian_id, kategori_pengabdian(kategori_pengabdian)"
      fields={fields}
    />
  );
}
