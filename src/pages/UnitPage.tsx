import CrudPage, { type Field } from '../components/CrudPage';
import type { Unit } from '../types';

const tipeLabel = { universitas: 'Universitas', fakultas: 'Fakultas', prodi: 'Program Studi' };

const fields: Field<Unit>[] = [
  { name: 'nama', label: 'Nama Unit', required: true, wide: true },
  {
    name: 'tipe',
    label: 'Tipe',
    type: 'select',
    required: true,
    options: Object.entries(tipeLabel).map(([value, label]) => ({ value, label })),
    render: (u) => tipeLabel[u.tipe],
  },
  {
    name: 'parent_id',
    label: 'Induk',
    type: 'select',
    source: { table: 'units', select: 'id, nama', order: 'nama', label: (u) => u.nama },
    render: (u) => u.parent?.nama ?? '-',
  },
];

export default function UnitPage() {
  return (
    <CrudPage<Unit>
      title="Unit"
      description="Hierarki unit (universitas › fakultas › prodi) menentukan cakupan operator dan validator HKI. Dokumen HKI memakai unit dosen pemilik saat diunggah."
      table="units"
      select="id, nama, tipe, parent_id, parent:units!parent_id(nama)"
      order={{ column: 'nama' }}
      fields={fields}
      pageSize={20}
    />
  );
}
