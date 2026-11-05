import { useProfile } from '../auth';
import CrudPage, { type Field, type RowValues } from '../components/CrudPage';
import { supabase } from '../lib/supabase';

type ArtikelMahasiswa = {
  id: number;
  judul: string;
  npm: string | null;
  nama: string;
  jenis_artikel: string;
  tahun: number | null;
  publisher: string | null;
  // [{ npm, nama }]
  anggota_mahasiswa: RowValues[];
  created_by: string | null;
  // hasil join (alias di query select)
  anggota_dosen?: { dosen_id: number; dosen: { nama: string } | null }[];
};

// pilihan sementara; tambahkan di sini jika ada jenis artikel baru
const jenisArtikel = [
  'Conference Nasional',
  'Conference Internasional',
  'Jurnal Nasional',
  'Jurnal Internasional',
].map((j) => ({ value: j, label: j }));

const namaMahasiswa = (m: RowValues) => (m.npm ? `${m.nama} (${m.npm})` : m.nama);

export default function ArtikelMahasiswaPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const isDosen = profile.role === 'dosen';
  const myDosenId = profile.dosen_id;

  if (isDosen && myDosenId == null) {
    return (
      <section className="page">
        <h1>Artikel Mahasiswa</h1>
        <p className="notice">
          Akun Anda belum dihubungkan ke data dosen. Hubungi admin untuk menghubungkannya di menu
          Pengguna.
        </p>
      </section>
    );
  }

  const fields: Field<ArtikelMahasiswa>[] = [
    { name: 'judul', label: 'Judul Artikel', required: true, wide: true },
    { name: 'npm', label: 'NPM' },
    { name: 'nama', label: 'Nama Mahasiswa', required: true },
    { name: 'jenis_artikel', label: 'Jenis Artikel', type: 'select', required: true, options: jenisArtikel },
    { name: 'tahun', label: 'Tahun', type: 'number', required: true },
    { name: 'publisher', label: 'Publisher', wide: true },
    {
      name: 'anggota_mahasiswa',
      label: 'Anggota Mahasiswa',
      type: 'rows',
      wide: true,
      rowFields: [
        { name: 'npm', label: 'NPM' },
        { name: 'nama', label: 'Nama mahasiswa', required: true },
      ],
      render: (a) => (a.anggota_mahasiswa ?? []).map(namaMahasiswa).join(', ') || '-',
    },
    {
      name: 'anggota_dosen',
      label: 'Anggota Dosen',
      type: 'multiselect',
      wide: true,
      source: { table: 'dosen', select: 'id, nama', order: 'nama', label: (d: any) => d.nama },
      junction: { table: 'artikel_mahasiswa_dosen', foreignKey: 'artikel_mahasiswa_id', valueKey: 'dosen_id' },
      getValues: (a) => (a.anggota_dosen ?? []).map((d) => d.dosen_id),
      // dosen yang menginput otomatis menjadi anggota dosen
      lockedValues: isDosen ? [String(myDosenId)] : undefined,
      render: (a) => (a.anggota_dosen ?? []).map((d) => d.dosen?.nama).join(', ') || '-',
    },
  ];

  // admin: semua; dosen: yang ia input atau ia menjadi anggota dosennya; pemantau: hanya melihat
  const canEdit = (a: ArtikelMahasiswa) =>
    isAdmin ||
    (isDosen &&
      (a.created_by === profile.id || (a.anggota_dosen ?? []).some((d) => d.dosen_id === myDosenId)));

  // pencarian tahun dan nama anggota dosen
  async function searchExtra(keyword: string) {
    const conditions = /^\d{4}$/.test(keyword) ? [`tahun.eq.${keyword}`] : [];
    const { data: dosen } = await supabase.from('dosen').select('id').ilike('nama', `%${keyword}%`);
    const dosenIds = (dosen ?? []).map((d) => d.id);
    if (dosenIds.length === 0) return conditions;
    const { data } = await supabase
      .from('artikel_mahasiswa_dosen')
      .select('artikel_mahasiswa_id')
      .in('dosen_id', dosenIds);
    const ids = [...new Set((data ?? []).map((a) => a.artikel_mahasiswa_id))];
    if (ids.length > 0) conditions.push(`id.in.(${ids.join(',')})`);
    return conditions;
  }

  return (
    <CrudPage<ArtikelMahasiswa>
      title="Artikel Mahasiswa"
      table="artikel_mahasiswa"
      select="*, anggota_dosen:artikel_mahasiswa_dosen(dosen_id, dosen(nama))"
      order={[
        { column: 'tahun', ascending: false },
        { column: 'id', ascending: false },
      ]}
      fields={fields}
      canCreate={isAdmin || isDosen}
      canEdit={canEdit}
      pageSize={10}
      searchColumns={['judul', 'npm', 'nama', 'jenis_artikel', 'publisher']}
      searchExtra={searchExtra}
      searchPlaceholder="Cari judul, NPM, nama mahasiswa, publisher, tahun, atau nama dosen..."
    />
  );
}
