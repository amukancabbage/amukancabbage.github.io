import CrudPage, { type Field } from '../components/CrudPage';
import type { Dosen } from '../types';

const fields: Field<Dosen>[] = [
  { name: 'nama', label: 'Nama', required: true },
  { name: 'nidn', label: 'NIDN', required: true },
  {
    name: 'prodi_id',
    label: 'Prodi',
    type: 'select',
    required: true,
    source: { table: 'prodi', select: 'id, prodi', order: 'prodi', label: (p) => p.prodi },
    render: (d) => d.prodi?.prodi ?? '-',
  },
];

export default function DosenPage() {
  return (
    <CrudPage<Dosen>
      title="Dosen"
      table="dosen"
      select="id, nama, nidn, prodi_id, prodi(prodi)"
      fields={fields}
    />
  );
}
