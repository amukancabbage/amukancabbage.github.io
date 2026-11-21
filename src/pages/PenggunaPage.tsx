import CrudPage, { type Field } from '../components/CrudPage';
import { lecturerSource, unitSource } from '../lib/search';
import { roleLabel, type Profile } from '../types';

const fields: Field<Profile>[] = [
  { name: 'email', label: 'Email', hideInForm: true },
  {
    name: 'role',
    label: 'Role',
    type: 'select',
    required: true,
    options: Object.entries(roleLabel).map(([value, label]) => ({ value, label })),
    render: (p) => roleLabel[p.role],
  },
  {
    name: 'dosen_id',
    label: 'Data Dosen',
    type: 'select',
    source: lecturerSource,
    render: (p) => p.dosen?.nama ?? '-',
  },
  {
    name: 'unit_id',
    label: 'Cakupan Unit (operator wajib; validator kosong = seluruh institusi)',
    type: 'select',
    source: unitSource,
    render: (p) => p.unit?.nama ?? '-',
  },
];

export default function PenggunaPage() {
  return (
    <CrudPage<Profile>
      title="Pengguna"
      description="Buat akun di Supabase dengan memilih Add user pada halaman Authentication. Atur perannya di sini dan tautkan akun dosen ke Data Dosen. Operator wajib memiliki unit. Validator tanpa unit dapat memvalidasi dokumen seluruh institusi."
      table="profiles"
      select="id, email, role, dosen_id, unit_id, dosen(nama), unit:units(nama)"
      order={{ column: 'email' }}
      fields={fields}
      canCreate={false}
      canDelete={() => false}
      pageSize={10}
      searchColumns={['email']}
      searchPlaceholder="Cari email"
      listFilter={{ kind: 'options', param: 'role', column: 'role', label: 'Peran', options: roleLabel }}
    />
  );
}
