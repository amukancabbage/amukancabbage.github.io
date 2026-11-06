import type { Jenis, Peran, StatusCocok, StatusHki, WorkflowStatus } from './types';

export const JENIS_LABEL: Record<Jenis, string> = {
  hak_cipta: 'Hak Cipta',
  paten: 'Paten',
  paten_sederhana: 'Paten Sederhana',
  merek: 'Merek',
  desain_industri: 'Desain Industri',
  dtlst: 'Desain Tata Letak Sirkuit Terpadu',
  rahasia_dagang: 'Rahasia Dagang',
  indikasi_geografis: 'Indikasi Geografis',
  pvt: 'Perlindungan Varietas Tanaman',
};

export const STATUS_HKI_LABEL: Record<StatusHki, string> = {
  permohonan: 'Permohonan',
  terdaftar: 'Terdaftar',
  ditolak: 'Ditolak',
  ditarik: 'Ditarik',
  kedaluwarsa: 'Kedaluwarsa',
};

// label juga dipakai di kolom "Status Dokumen" ekspor
export const WORKFLOW_LABEL: Record<WorkflowStatus, string> = {
  DRAFT: 'Draf',
  EXTRACTING: 'Dibaca AI',
  EXTRACTION_FAILED: 'AI gagal',
  NEEDS_VERIFICATION: 'Perlu verifikasi',
  SUBMITTED: 'Menunggu validasi',
  NEEDS_REVISION: 'Perlu revisi',
  REJECTED: 'Ditolak',
  ARCHIVED: 'Terarsip',
  CORRECTION_REQUESTED: 'Permintaan koreksi',
};

export const AI_ERROR_TEXT: Record<string, string> = {
  JENIS_TIDAK_DIKENALI: 'AI tidak dapat menentukan jenis HKI dari dokumen ini.',
  RATE_LIMITED: 'Layanan AI sedang sibuk.',
  TIMEOUT: 'Layanan AI terlalu lama merespons.',
  UPSTREAM_ERROR: 'Layanan AI sedang bermasalah.',
  AUTH_FAILED: 'Konfigurasi layanan AI bermasalah; hubungi admin.',
  CREDIT_EXHAUSTED: 'Kuota layanan AI habis; hubungi admin.',
  BUDGET_EXCEEDED: 'Batas biaya AI bulan ini tercapai; hubungi admin.',
  NO_API_KEY: 'Kunci layanan AI belum dikonfigurasi; hubungi admin.',
  INVALID_JSON: 'AI mengembalikan hasil yang tidak dapat dibaca.',
  UNSUPPORTED_FILE: 'Halaman dokumen tidak dapat disiapkan. Unggah ulang lewat browser, atau ubah foto ke JPG/PNG.',
  NO_MAIN_FILE: 'Berkas utama tidak ditemukan.',
  REQUEST_FAILED: 'Permintaan ke layanan AI gagal. Coba lagi.',
};

export function aiErrorText(code: unknown): string {
  const c = typeof code === 'string' ? code : '';
  return AI_ERROR_TEXT[c] ?? 'Terjadi galat saat membaca dokumen.';
}

export const PERAN_LABEL: Record<Peran, string> = {
  pencipta: 'Pencipta / Inventor',
  pemegang: 'Pemegang Hak',
  kuasa: 'Kuasa',
};

export const COCOK_LABEL: Record<StatusCocok, string> = {
  disarankan: 'Menunggu konfirmasi',
  dikonfirmasi: 'Dikonfirmasi',
  ditolak: 'Bukan dosen ini',
  eksternal: 'Eksternal',
  ambigu: 'Ambigu',
};

export type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'textarea' | 'url' | 'jenis' | 'status_hki' | 'master';
  master?: 'sumber_dana' | 'jenis_ciptaan';
  help?: string;
};

export const COMMON_FIELDS: FieldDef[] = [
  { key: 'jenis', label: 'Jenis HKI', type: 'jenis' },
  { key: 'judul', label: 'Judul', type: 'textarea' },
  { key: 'no_permohonan', label: 'Nomor Permohonan' },
  { key: 'tgl_permohonan', label: 'Tanggal Permohonan', type: 'date' },
  { key: 'no_sertifikat', label: 'Nomor Sertifikat / Pencatatan' },
  { key: 'status_hki', label: 'Status HKI', type: 'status_hki' },
];

export const SPECIFIC_FIELDS: Record<Jenis, FieldDef[]> = {
  hak_cipta: [
    { key: 'jenis_ciptaan', label: 'Jenis Ciptaan', type: 'master', master: 'jenis_ciptaan' },
    { key: 'tanggal_pengumuman', label: 'Tanggal Pertama Diumumkan', type: 'date' },
    { key: 'tempat_pengumuman', label: 'Tempat Pertama Diumumkan' },
  ],
  paten: [
    { key: 'klasifikasi_ipc', label: 'Klasifikasi IPC' },
    { key: 'data_prioritas', label: 'Data Prioritas' },
  ],
  paten_sederhana: [
    { key: 'klasifikasi_ipc', label: 'Klasifikasi IPC' },
    { key: 'data_prioritas', label: 'Data Prioritas' },
  ],
  merek: [
    { key: 'kelas_nice', label: 'Kelas Nice' },
    { key: 'uraian_barang_jasa', label: 'Uraian Barang/Jasa', type: 'textarea' },
  ],
  desain_industri: [
    { key: 'klasifikasi_locarno', label: 'Klasifikasi Locarno' },
    { key: 'jumlah_tampilan', label: 'Jumlah Tampilan' },
  ],
  dtlst: [{ key: 'tanggal_eksploitasi', label: 'Tanggal Pertama Dieksploitasi', type: 'date' }],
  rahasia_dagang: [{ key: 'objek_pencatatan', label: 'Objek Pencatatan', type: 'textarea' }],
  indikasi_geografis: [
    { key: 'nama_ig', label: 'Nama Indikasi Geografis' },
    { key: 'produk_ig', label: 'Produk' },
  ],
  pvt: [
    { key: 'nama_varietas', label: 'Nama Varietas' },
    { key: 'pemulia', label: 'Pemulia' },
  ],
};

export const MANUAL_FIELDS: FieldDef[] = [
  { key: 'sumber_dana', label: 'Sumber Dana', type: 'master', master: 'sumber_dana' },
  { key: 'kegiatan_terkait', label: 'Kegiatan Terkait', help: 'Mis. judul penelitian/pengabdian terkait' },
  { key: 'pdki_url', label: 'Tautan PDKI', type: 'url' },
];

export const VALIDITY_FIELDS: FieldDef[] = [
  { key: 'berlaku_mulai', label: 'Berlaku Mulai', type: 'date' },
  { key: 'berlaku_akhir', label: 'Berlaku Sampai', type: 'date' },
];

export const CORE_FIELDS = ['judul', 'no_permohonan', 'tgl_permohonan', 'no_sertifikat'];

export function fieldsFor(jenis: Jenis | null): FieldDef[] {
  return [...COMMON_FIELDS, ...(jenis ? SPECIFIC_FIELDS[jenis] : [])];
}

export function fieldLabel(key: string): string {
  const all = [...COMMON_FIELDS, ...Object.values(SPECIFIC_FIELDS).flat(), ...MANUAL_FIELDS, ...VALIDITY_FIELDS];
  return all.find((f) => f.key === key)?.label ?? key;
}

export const DELETABLE: WorkflowStatus[] = [
  'DRAFT',
  'NEEDS_VERIFICATION',
  'NEEDS_REVISION',
  'EXTRACTION_FAILED',
  'REJECTED',
];

// tab "HKI saya"
export const MINE_TABS: { key: string; label: string; statuses: WorkflowStatus[] | null }[] = [
  { key: 'semua', label: 'Semua', statuses: null },
  { key: 'perlu', label: 'Perlu tindakan', statuses: ['DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED', 'CORRECTION_REQUESTED'] },
  { key: 'proses', label: 'Diproses', statuses: ['EXTRACTING', 'SUBMITTED'] },
  { key: 'arsip', label: 'Terarsip', statuses: ['ARCHIVED'] },
  { key: 'tolak', label: 'Ditolak', statuses: ['REJECTED'] },
];

export const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'Dokumen tidak ditemukan.',
  VERSION_CONFLICT: 'Dokumen sudah diubah di tempat lain. Muat ulang untuk melihat versi terbaru.',
  BULK_INELIGIBLE: 'Tidak layak disetujui massal.',
};

export const BULK_REASON: Record<string, string> = {
  NOT_FOUND: 'tidak ditemukan',
  STATUS: 'status bukan menunggu validasi',
  NO_AI_DATA: 'tidak ada data AI',
  HUMAN_EDITED: 'ada isian yang diubah manusia',
  LOW_CONFIDENCE: 'ada field berkeyakinan rendah',
  WARNINGS: 'ada peringatan',
  INCOMPLETE: 'data belum lengkap',
  DUPLICATE: 'ada kemungkinan duplikat',
  CERT_DUPLICATE: 'nomor sertifikat sudah diarsipkan',
};

export const NOTIF_TYPE_LABEL: Record<string, string> = {
  extraction_done: 'AI selesai',
  extraction_failed: 'AI gagal',
  submitted: 'Pengajuan baru',
  review_approved: 'Disetujui',
  review_revision: 'Perlu revisi',
  review_rejected: 'Ditolak',
  person_suggested: 'Konfirmasi pencipta',
  person_claim: 'Jawaban pencipta',
  correction_requested: 'Permintaan koreksi',
};

export const SOON_DAYS = 180;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;
export const MAX_FILES_PER_SESSION = 10;
export const EXPORT_MAX_ROWS = 20000;
export const EXPORT_MAX_ZIP = 300;
export const MAX_ALIASES = 20;
