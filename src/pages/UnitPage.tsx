import CrudPage, { type Field } from '../components/CrudPage';
import { unitSource } from '../lib/search';
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
    source: unitSource,
    render: (u) => u.parent?.nama ?? '-',
  },
];

export default function UnitPage() {
  return (
    <CrudPage<Unit>
      title="Unit"
      description="Cakupan operator dan validator HKI mengikuti hierarki universitas, fakultas, dan program studi. Dokumen HKI memakai unit dosen pemilik saat diunggah."
      table="units"
      select="id, nama, tipe, parent_id, parent:units!parent_id(nama)"
      order={{ column: 'nama' }}
      fields={fields}
      pageSize={20}
      listFilter={{ kind: 'options', param: 'tipe', column: 'tipe', label: 'Tipe', options: tipeLabel }}
    />
  );
}
