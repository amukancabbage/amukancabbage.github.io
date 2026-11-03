import { useProfile } from '../auth';
import CrudPage, { type Field, type FormValues } from '../components/CrudPage';
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

const timOf = (form: FormValues) => form.penelitian_anggota as string[];

// nilai khusus di pilihan Ketua untuk ketua yang tidak ada di daftar dosen
const KETUA_LUAR = 'luar';
const isKetuaLuar = (form: FormValues) => form.dosen_id === KETUA_LUAR;

// ketua wajib salah satu anggota tim, kecuali ketua dari luar daftar dosen
function validate(form: FormValues) {
  if (!isKetuaLuar(form) && !timOf(form).includes(form.dosen_id as string)) {
    return 'Ketua harus dipilih dari Tim Peneliti yang dicentang.';
  }
  return null;
}

function namaKetua(p: Penelitian) {
  if (p.dosen?.nama) return p.dosen.nama;
  return p.ketua_luar ? `${p.ketua_luar} (luar)` : '-';
}

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
      // tim = ketua + anggota; ketua disimpan di dosen_id, sisanya di penelitian_anggota
      name: 'penelitian_anggota',
      label: 'Tim Peneliti',
      type: 'multiselect',
      wide: true,
      source: dosenSource,
      junction: {
        table: 'penelitian_anggota',
        foreignKey: 'penelitian_id',
        valueKey: 'dosen_id',
        exclude: 'dosen_id',
      },
      getValues: (p) => [
        ...(p.dosen_id != null ? [p.dosen_id] : []),
        ...(p.penelitian_anggota ?? []).map((a) => a.dosen_id),
      ],
      // dosen yang menginput otomatis masuk tim
      lockedValues: isDosen ? [String(myDosenId)] : undefined,
      hideInTable: true,
    },
    {
      name: 'dosen_id',
      label: 'Ketua',
      type: 'select',
      required: true,
      source: dosenSource,
      filterOptions: (opts, form) => opts.filter((o) => timOf(form).includes(String(o.value))),
      extraOptions: [{ value: KETUA_LUAR, label: 'Ketua dari luar daftar dosen…' }],
      getValue: (p) => (p.dosen_id != null ? String(p.dosen_id) : p.ketua_luar ? KETUA_LUAR : ''),
      render: namaKetua,
    },
    {
      name: 'ketua_luar',
      label: 'Nama Ketua (luar daftar dosen)',
      required: true,
      showIf: isKetuaLuar,
      hideInTable: true,
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
      // hanya untuk kolom tabel; diisi lewat Tim Peneliti di atas
      name: 'id',
      label: 'Anggota',
      hideInForm: true,
      render: (p) =>
        (p.penelitian_anggota ?? []).map((a) => a.dosen?.nama).join(', ') || '-',
    },
    { name: 'url_bukti', label: 'URL Bukti', type: 'url', render: (p) => link(p.url_bukti) },
    { name: 'url_dokumen', label: 'URL Dokumen', type: 'url', render: (p) => link(p.url_dokumen) },
    { name: 'keterangan', label: 'Keterangan', type: 'textarea', wide: true, hideInTable: true },
  ];

  // admin: semua; dosen: penelitian yang ia ketuai atau ia input; pemantau: hanya melihat
  const canEdit = (p: Penelitian) =>
    isAdmin || (isDosen && (p.dosen_id === myDosenId || p.created_by === profile.id));

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
      validate={validate}
    />
  );
}
