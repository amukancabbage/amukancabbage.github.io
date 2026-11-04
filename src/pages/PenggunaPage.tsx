import CrudPage, { type Field } from '../components/CrudPage';
import type { Profile } from '../types';

const roleLabel = { admin: 'Admin', dosen: 'Dosen', pemantau: 'Pemantau' };

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
];

export default function PenggunaPage() {
  return (
    <CrudPage<Profile>
      title="Pengguna"
      description="Akun baru dibuat di Supabase → Authentication → Add user, lalu atur role-nya di sini. Untuk role Dosen, hubungkan juga ke Data Dosen."
      table="profiles"
      select="id, email, role, dosen_id, dosen(nama)"
      order={{ column: 'email' }}
      fields={fields}
      canCreate={false}
      canDelete={() => false}
      pageSize={10}
    />
  );
}
