import { useProfile } from '../auth';
import CrudPage, { type Field, type FormValues } from './CrudPage';

// Halaman bersama untuk kegiatan dosen yang punya ketua, tim, dan subkategori
// (penelitian, pengabdian, ...). Nama kolom mengikuti pola nama tabel, contoh table="pengabdian":
//   judul_pengabdian, pengabdian_anggota (pengabdian_id, dosen_id),
//   subkategori_pengabdian (sub_kategori_pengabdian, kategori_pengabdian_id),
//   kategori_pengabdian (kategori_pengabdian), pengabdian.sub_kategori_pengabdian_id

export type Kegiatan = {
  id: number;
  // ketua: salah satu dari dosen_id (daftar dosen) atau ketua_luar (nama bebas)
  dosen_id: number | null;
  ketua_luar: string | null;
  tahun: number;
  publikasi: string | null;
  url_bukti: string | null;
  url_dokumen: string | null;
  keterangan: string | null;
  // akun yang menginput (auth.users.id)
  created_by: string | null;
  // hasil join (alias di query select)
  dosen?: { nama: string } | null;
  anggota?: { dosen_id: number; dosen: { nama: string } | null }[];
  sub?: { nama: string; kategori: { nama: string } | null } | null;
  // kolom yang namanya bergantung tabel, mis. judul_penelitian
  [column: string]: unknown;
};

type Props = {
  title: string;
  table: string;
  timLabel: string;
};

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

const timOf = (form: FormValues) => form.anggota as string[];

// nilai khusus di pilihan Ketua untuk ketua yang tidak ada di daftar dosen
const KETUA_LUAR = 'luar';
const isKetuaLuar = (form: FormValues) => form.dosen_id === KETUA_LUAR;

function namaKetua(k: Kegiatan) {
  if (k.dosen?.nama) return k.dosen.nama;
  return k.ketua_luar ? `${k.ketua_luar} (luar)` : '-';
}

const namaSub = (s: { nama: string; kategori: { nama: string } | null } | null | undefined) =>
  s ? `${s.kategori?.nama ?? '-'} › ${s.nama}` : '-';

export default function KegiatanPage({ title, table, timLabel }: Props) {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const isDosen = profile.role === 'dosen';
  const myDosenId = profile.dosen_id;

  if (isDosen && myDosenId == null) {
    return (
      <section className="page">
        <h1>{title}</h1>
        <p className="notice">
          Akun Anda belum dihubungkan ke data dosen. Hubungi admin untuk menghubungkannya di menu
          Pengguna.
        </p>
      </section>
    );
  }

  const subTable = `subkategori_${table}`;
  const subColumn = `sub_kategori_${table}`;
  const kategoriTable = `kategori_${table}`;

  // ketua wajib salah satu anggota tim, kecuali ketua dari luar daftar dosen
  function validate(form: FormValues) {
    if (!isKetuaLuar(form) && !timOf(form).includes(form.dosen_id as string)) {
      return `Ketua harus dipilih dari ${timLabel} yang dicentang.`;
    }
    return null;
  }

  const fields: Field<Kegiatan>[] = [
    { name: `judul_${table}`, label: `Judul ${title}`, required: true, wide: true },
    {
      // tim = ketua + anggota; ketua disimpan di dosen_id, sisanya di tabel anggota
      name: 'anggota',
      label: timLabel,
      type: 'multiselect',
      wide: true,
      source: dosenSource,
      junction: {
        table: `${table}_anggota`,
        foreignKey: `${table}_id`,
        valueKey: 'dosen_id',
        exclude: 'dosen_id',
      },
      getValues: (k) => [
        ...(k.dosen_id != null ? [k.dosen_id] : []),
        ...(k.anggota ?? []).map((a) => a.dosen_id),
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
      getValue: (k) => (k.dosen_id != null ? String(k.dosen_id) : k.ketua_luar ? KETUA_LUAR : ''),
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
      name: `${subColumn}_id`,
      label: 'Subkategori',
      type: 'select',
      required: true,
      source: {
        table: subTable,
        select: `id, nama:${subColumn}, kategori:${kategoriTable}(nama:${kategoriTable})`,
        order: subColumn,
        label: namaSub,
      },
      render: (k) => namaSub(k.sub),
    },
    { name: 'tahun', label: 'Tahun', type: 'number', required: true },
    { name: 'publikasi', label: 'Publikasi' },
    {
      // hanya untuk kolom tabel; diisi lewat tim di atas
      name: 'id',
      label: 'Anggota',
      hideInForm: true,
      render: (k) => (k.anggota ?? []).map((a) => a.dosen?.nama).join(', ') || '-',
    },
    { name: 'url_bukti', label: 'URL Bukti', type: 'url', render: (k) => link(k.url_bukti) },
    { name: 'url_dokumen', label: 'URL Dokumen', type: 'url', render: (k) => link(k.url_dokumen) },
    { name: 'keterangan', label: 'Keterangan', type: 'textarea', wide: true, hideInTable: true },
  ];

  // admin: semua; dosen: yang ia ketuai atau ia input; pemantau: hanya melihat
  const canEdit = (k: Kegiatan) =>
    isAdmin || (isDosen && (k.dosen_id === myDosenId || k.created_by === profile.id));

  // dosen!dosen_id = ketua; perlu petunjuk karena dosen juga terhubung lewat tabel anggota
  const select = [
    '*',
    'dosen:dosen!dosen_id(nama)',
    `anggota:${table}_anggota(dosen_id, dosen(nama))`,
    `sub:${subTable}(nama:${subColumn}, kategori:${kategoriTable}(nama:${kategoriTable}))`,
  ].join(', ');

  return (
    <CrudPage<Kegiatan>
      // key: state form tidak terbawa saat berpindah antar halaman kegiatan
      key={table}
      title={title}
      table={table}
      select={select}
      order={{ column: 'tahun', ascending: false }}
      fields={fields}
      canCreate={isAdmin || isDosen}
      canEdit={canEdit}
      validate={validate}
    />
  );
}
