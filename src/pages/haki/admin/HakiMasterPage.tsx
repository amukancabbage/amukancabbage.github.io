import CrudPage, { type Field } from '../../../components/CrudPage';
import type { MasterItem } from '../../../haki/types';

const kategoriLabel = { sumber_dana: 'Sumber Dana', jenis_ciptaan: 'Jenis Ciptaan' };

const fields: Field<MasterItem>[] = [
  {
    name: 'kategori',
    label: 'Kategori',
    type: 'select',
    required: true,
    options: Object.entries(kategoriLabel).map(([value, label]) => ({ value, label })),
    render: (m) => kategoriLabel[m.kategori],
  },
  { name: 'nilai', label: 'Kode (a-z, 0-9, _)', required: true },
  { name: 'label', label: 'Label', required: true },
  { name: 'urutan', label: 'Urutan', type: 'number', required: true },
  {
    name: 'aktif',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { value: 'true', label: 'Aktif' },
      { value: 'false', label: 'Nonaktif' },
    ],
    getValue: (m) => String(m.aktif),
    render: (m) => (m.aktif ? 'Aktif' : 'Nonaktif'),
  },
];

export default function HakiMasterPage() {
  return (
    <CrudPage<MasterItem>
      title="Master HAKI"
      description="Nilai master tidak dihapus agar dokumen lama tetap terbaca: nonaktifkan item yang tidak dipakai lagi. Kode tidak dapat diubah setelah dibuat."
      table="hki_master_items"
      select="*"
      order={[{ column: 'kategori' }, { column: 'urutan' }]}
      fields={fields}
      canDelete={() => false}
      validate={(form) => (/^[a-z0-9_]{1,80}$/.test(String(form.nilai)) ? null : 'Kode hanya huruf kecil, angka, dan garis bawah (maks. 80).')}
      pageSize={30}
      searchColumns={['label', 'nilai']}
    />
  );
}
