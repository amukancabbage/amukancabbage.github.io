import { useProfile } from '../auth';
import CrudPage, { type Field } from '../components/CrudPage';
import type { Penelitian } from '../types';

function link(url: string | null) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      Buka
    </a>
  ) : (
    '-'
  );
}

const dosenSource = { table: 'dosen', select: 'id, nama', order: 'nama', label: (d: any) => d.nama };

export default function PenelitianPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const isDosen = profile.role === 'dosen';
  const myDosenId = profile.dosen_id;

  if (isDosen && myDosenId == null) {
    return (
      <section className="page">
        <h1>Penelitian</h1>
        <p className="notice">
          Akun Anda belum dihubungkan ke data dosen. Hubungi admin untuk menghubungkannya di menu
          Pengguna.
        </p>
      </section>
    );
  }

  const fields: Field<Penelitian>[] = [
    { name: 'judul_penelitian', label: 'Judul Penelitian', required: true, wide: true },
    {
      name: 'dosen_id',
      label: 'Ketua',
      type: 'select',
      required: true,
      // dosen tidak memilih ketua: otomatis dirinya sendiri
      hideInForm: !isAdmin,
      source: dosenSource,
      render: (p) => p.dosen?.nama ?? '-',
    },
    {
      name: 'sub_kategori_penelitian_id',
      label: 'Subkategori',
      type: 'select',
      required: true,
      source: {
        table: 'subkategori_penelitian',
        select: 'id, sub_kategori_penelitian, kategori_penelitian(kategori_penelitian)',
        order: 'sub_kategori_penelitian',
        label: (s) =>
          `${s.kategori_penelitian?.kategori_penelitian ?? '-'} › ${s.sub_kategori_penelitian}`,
      },
      render: (p) => {
        const s = p.subkategori_penelitian;
        return s
          ? `${s.kategori_penelitian?.kategori_penelitian ?? '-'} › ${s.sub_kategori_penelitian}`
          : '-';
      },
    },
    { name: 'tahun', label: 'Tahun', type: 'number', required: true },
    { name: 'publikasi', label: 'Publikasi' },
    {
      name: 'penelitian_anggota',
      label: 'Anggota',
      type: 'multiselect',
      wide: true,
      source: dosenSource,
      junction: { table: 'penelitian_anggota', foreignKey: 'penelitian_id', valueKey: 'dosen_id' },
      getValues: (p) => (p.penelitian_anggota ?? []).map((a) => a.dosen_id),
      render: (p) =>
        (p.penelitian_anggota ?? []).map((a) => a.dosen?.nama).join(', ') || '-',
    },
    { name: 'url_bukti', label: 'URL Bukti', type: 'url', render: (p) => link(p.url_bukti) },
    { name: 'url_dokumen', label: 'URL Dokumen', type: 'url', render: (p) => link(p.url_dokumen) },
    { name: 'keterangan', label: 'Keterangan', type: 'textarea', wide: true, hideInTable: true },
  ];

  // admin: semua; dosen: hanya penelitian yang ia ketuai; pemantau: hanya melihat
  const canEdit = (p: Penelitian) => isAdmin || (isDosen && p.dosen_id === myDosenId);

  return (
    <CrudPage<Penelitian>
      title="Penelitian"
      table="penelitian"
      // dosen!dosen_id = ketua; perlu petunjuk karena dosen juga terhubung lewat penelitian_anggota
      select="*, dosen:dosen!dosen_id(nama), penelitian_anggota(dosen_id, dosen(nama)), subkategori_penelitian(sub_kategori_penelitian, kategori_penelitian(kategori_penelitian))"
      order={{ column: 'tahun', ascending: false }}
      fields={fields}
      canCreate={isAdmin || isDosen}
      canEdit={canEdit}
      fixedValues={isDosen ? { dosen_id: myDosenId } : undefined}
    />
  );
}
