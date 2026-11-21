import CrudPage, { type Field } from '../components/CrudPage';
import { programSource } from '../lib/search';
import type { Dosen } from '../types';

const fields: Field<Dosen>[] = [
  { name: 'nama', label: 'Nama', required: true },
  { name: 'nidn', label: 'NIDN', required: true },
  {
    name: 'prodi_id',
    label: 'Prodi',
    type: 'select',
    required: true,
    source: programSource,
    render: (d) => d.prodi?.prodi ?? '-',
  },
];

export default function DosenPage() {
  return (
    <CrudPage<Dosen>
      title="Dosen"
      table="dosen"
      select="id, nama, nidn, prodi_id, prodi(prodi)"
      order={[{ column: 'prodi(prodi)' }, { column: 'nama' }]}
      fields={fields}
      pageSize={10}
      searchColumns={['nama', 'nidn']}
      searchPlaceholder="Cari nama atau NIDN"
      listFilter={{ kind: 'source', param: 'prodi', column: 'prodi_id', label: 'Prodi', source: programSource }}
    />
  );
}
