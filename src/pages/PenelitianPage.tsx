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

const fields: Field<Penelitian>[] = [
  { name: 'judul_penelitian', label: 'Judul Penelitian', required: true, wide: true },
  {
    name: 'dosen_id',
    label: 'Dosen',
    type: 'select',
    required: true,
    source: { table: 'dosen', select: 'id, nama', order: 'nama', label: (d) => d.nama },
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
      return s ? `${s.kategori_penelitian?.kategori_penelitian ?? '-'} › ${s.sub_kategori_penelitian}` : '-';
    },
  },
  { name: 'tahun', label: 'Tahun', type: 'number', required: true },
  { name: 'publikasi', label: 'Publikasi' },
  { name: 'url_bukti', label: 'URL Bukti', type: 'url', render: (p) => link(p.url_bukti) },
  { name: 'url_dokumen', label: 'URL Dokumen', type: 'url', render: (p) => link(p.url_dokumen) },
  { name: 'keterangan', label: 'Keterangan', type: 'textarea', wide: true, hideInTable: true },
];

export default function PenelitianPage() {
  return (
    <CrudPage<Penelitian>
      title="Penelitian"
      table="penelitian"
      select="*, dosen(nama), subkategori_penelitian(sub_kategori_penelitian, kategori_penelitian(kategori_penelitian))"
      order={{ column: 'tahun', ascending: false }}
      fields={fields}
    />
  );
}
