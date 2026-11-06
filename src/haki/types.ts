export type Jenis =
  | 'hak_cipta'
  | 'paten'
  | 'paten_sederhana'
  | 'merek'
  | 'desain_industri'
  | 'dtlst'
  | 'rahasia_dagang'
  | 'indikasi_geografis'
  | 'pvt';

export type StatusHki = 'permohonan' | 'terdaftar' | 'ditolak' | 'ditarik' | 'kedaluwarsa';

export type WorkflowStatus =
  | 'DRAFT'
  | 'EXTRACTING'
  | 'EXTRACTION_FAILED'
  | 'NEEDS_VERIFICATION'
  | 'SUBMITTED'
  | 'NEEDS_REVISION'
  | 'REJECTED'
  | 'ARCHIVED'
  | 'CORRECTION_REQUESTED';

export type Peran = 'pencipta' | 'pemegang' | 'kuasa';
export type StatusCocok = 'disarankan' | 'dikonfirmasi' | 'ditolak' | 'eksternal' | 'ambigu';

export type HkiRecord = {
  id: string;
  jenis: Jenis | null;
  judul: string | null;
  no_permohonan: string | null;
  tgl_permohonan: string | null;
  no_sertifikat: string | null;
  status_hki: StatusHki | null;
  berlaku_mulai: string | null;
  berlaku_akhir: string | null;
  sumber_dana: string | null;
  kegiatan_terkait: string | null;
  pdki_url: string | null;
  unit_id: number | null;
  owner_dosen_id: number;
  created_by: string | null;
  workflow_status: WorkflowStatus;
  extra: Record<string, unknown>;
  versi: number;
  locked: boolean;
  reread_count?: number;
  submitted_at: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
};

// baris view hki_record_list
export type HkiListRow = HkiRecord & {
  tahun: number | null;
  owner_nama: string | null;
  unit_nama: string | null;
  pencipta: string | null;
  pemegang: string | null;
  min_confidence: number | null;
};

export type HkiPerson = {
  id: number;
  record_id: string;
  urutan: number;
  nama: string;
  nama_normal: string;
  peran: Peran;
  alamat: string | null;
  kewarganegaraan: string | null;
  dosen_id: number | null;
  status_cocok: StatusCocok;
  link_manual: boolean;
  confidence: number | null;
  page: number | null;
  evidence: string | null;
  dosen?: { nama: string } | null;
};

export type HkiFile = {
  id: string;
  record_id: string;
  jenis: 'utama' | 'lampiran';
  storage_path: string;
  nama_asli: string;
  mime: string;
  ukuran: number;
  sha256: string;
  halaman: number | null;
  prep: { pages?: string[]; meta?: Record<string, unknown> };
  created_at: string;
};

export type FieldValue = {
  record_id: string;
  field: string;
  nilai_ai: string | null;
  nilai_final: string | null;
  confidence: number | null;
  page: number | null;
  evidence: string | null;
  dikonfirmasi: boolean;
  diubah: boolean;
};

export type Problem = { code: string; field?: string; message: string };

export type Duplicates = {
  total: number;
  items: { id: string; alasan: string; skor: number; judul: string | null; workflow_status: WorkflowStatus }[];
};

export type RecordCaps = {
  edit: boolean;
  upload: boolean;
  submit: boolean;
  review: boolean;
  correction: boolean;
  delete: boolean;
  extract: boolean;
  edit_persons: boolean;
};

export type RecordMeta = {
  caps: RecordCaps;
  is_owner: boolean;
  reread_count: number;
  max_rereads: number;
  problems: Problem[];
  warnings: Problem[];
  duplicates: Duplicates;
  bulk_ineligible: string | null;
};

export type HistoryItem = {
  at: string;
  kind: 'review' | 'audit';
  aksi: string;
  catatan: string | null;
  detail: Record<string, string> | null;
  actor: string | null;
};

export type ReviewAction = {
  id: number;
  aksi: string;
  catatan: string | null;
  catatan_field: Record<string, string> | null;
  created_at: string;
};

export type Notification = {
  id: number;
  tipe: string;
  judul: string;
  isi: string | null;
  link: string | null;
  record_id: string | null;
  dibaca_at: string | null;
  created_at: string;
};

export type MasterItem = {
  id: number;
  kategori: 'sumber_dana' | 'jenis_ciptaan';
  nilai: string;
  label: string;
  aktif: boolean;
  urutan: number;
};

export type Suggestion = {
  person_id: number;
  nama_tertulis: string;
  peran: Peran;
  judul: string | null;
  jenis: Jenis | null;
  pengunggah: string | null;
  created_at: string;
};
