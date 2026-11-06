import CrudPage, { type Field } from '../components/CrudPage';
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
    source: { table: 'dosen', select: 'id, nama', order: 'nama', label: (d) => d.nama },
    render: (p) => p.dosen?.nama ?? '-',
  },
  {
    name: 'unit_id',
    label: 'Cakupan Unit (operator wajib; validator kosong = seluruh institusi)',
    type: 'select',
    source: { table: 'units', select: 'id, nama', order: 'nama', label: (u) => u.nama },
    render: (p) => p.unit?.nama ?? '-',
  },
];

export default function PenggunaPage() {
  return (
    <CrudPage<Profile>
      title="Pengguna"
      description="Akun baru dibuat di Supabase → Authentication → Add user, lalu atur role-nya di sini. Dosen dihubungkan ke Data Dosen. Operator wajib punya unit. Validator tanpa unit berarti memvalidasi seluruh institusi."
      table="profiles"
      select="id, email, role, dosen_id, unit_id, dosen(nama), unit:units(nama)"
      order={{ column: 'email' }}
      fields={fields}
      canCreate={false}
      canDelete={() => false}
      pageSize={10}
    />
  );
}
