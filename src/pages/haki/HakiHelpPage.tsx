const FAQ: [string, string][] = [
  [
    'Bagaimana alur dokumen HKI?',
    'Unggah sertifikat → (opsional) dibaca AI → periksa dan lengkapi metadata serta daftar pencipta → ajukan ke validator → validator menyetujui (terarsip), meminta revisi, atau menolak. Dokumen terarsip dapat diminta koreksi.',
  ],
  [
    'Siapa yang dapat mengajukan?',
    'Hanya dosen pemilik dokumen. Operator dapat mengunggah atas nama dosen di unitnya dan melengkapi data, tetapi pengajuan tetap dilakukan dosen.',
  ],
  [
    'Mengapa beberapa field berwarna kuning atau merah?',
    'Keyakinan AI pada nilai itu rendah atau nilainya kosong. Periksa terhadap dokumen asli, lalu ubah atau centang “sudah saya periksa” sebelum mengajukan.',
  ],
  [
    'Apa arti status pencipta “Menunggu konfirmasi”?',
    'Nama di dokumen dicocokkan dengan seorang dosen. Dosen tersebut harus menjawab di halaman Konfirmasi Pencipta. Sebelum menjawab “Ya”, ia tidak dapat membuka dokumen.',
  ],
  [
    'Nama saya tidak tercocokkan otomatis.',
    'Nama pendek harus sama persis, dan nama yang mirip dengan beberapa dosen ditandai “Ambigu”. Tambahkan variasi nama Anda di menu Alias Nama, atau minta pemilik dokumen menautkan manual.',
  ],
  [
    'Apa yang terjadi saat “Baca ulang AI”?',
    'Semua isian ditimpa hasil bacaan baru, termasuk yang sudah Anda ubah. Jumlah baca ulang dibatasi per dokumen.',
  ],
  [
    'Dokumen mana yang dapat dihapus?',
    'Draf, perlu verifikasi, perlu revisi, AI gagal, dan ditolak. Dokumen yang sedang dibaca AI, menunggu validasi, terarsip, atau sedang dikoreksi tidak dapat dihapus.',
  ],
  [
    'Bagaimana masa berlaku dihitung?',
    'Paten 20 tahun dan paten sederhana/merek/desain industri 10 tahun sejak tanggal permohonan. Hak cipta jenis tertentu 50 tahun sejak tahun pengumuman. Selebihnya ditetapkan validator.',
  ],
  [
    'Tahun di filter dan laporan memakai tanggal apa?',
    'Tahun tanggal permohonan, bukan tanggal unggah.',
  ],
  [
    'Pintasan keyboard validator?',
    'Di layar dokumen dari antrean: N berikutnya, P sebelumnya, A setujui, R minta revisi, ? bantuan.',
  ],
];

export default function HakiHelpPage() {
  return (
    <div className="page">
      <h1>Bantuan HAKI</h1>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q} className="card pad">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
