# Domain & data — Arsip HAKI

## 1. Entitas inti (padanan tabel sumber)

| Entitas | Arti bisnis | Catatan |
|---|---|---|
| Unit | Hierarki universitas/fakultas/prodi | `parent_id`, tipe |
| User | Akun lokal (tanpa password di sumber) | tautan SIA `sso_subject` |
| UserRole | Peran + cakupan unit opsional | `source`: sia \| manual |
| LecturerAlias | Variasi nama dosen | maks 20/user |
| IpRecord | Dokumen HKI | workflow, versi, soft delete |
| IpPerson | Pencipta/pemegang/kuasa | match status, link_manual |
| File | Berkas utama/lampiran | sha256, mime, storage_key |
| FieldValue | Nilai AI vs final per field | keyakinan, evidence, flags ubah |
| ExtractionJob | Log panggilan model | token, biaya, cache |
| ReviewAction | Ajukan / approve / revisi / tolak / koreksi | catatan + catatan_field |
| RecordVersion | Snapshot append-ish | saat ajukan/keputusan/koreksi |
| AuditLog | Jejak append-only | jangan UPDATE/DELETE |
| Notification | In-app (+ email) | |
| AppSetting | Override config AI | key `ai.*` |
| MasterItem | Master aktif/nonaktif | kategori+nilai unik |
| PersonRejection | “Bukan saya” bertahan | unik per record+nama+user |

Di target Supabase: rancang tabel Postgres setara; file ke **Storage**; job AI ke Edge Function / queue; audit via trigger RLS/REVOKE.

## 2. Kolom penting `IpRecord`

Umum: `jenis`, `judul`, `no_permohonan`, `tgl_permohonan`, `no_sertifikat`, `status_hki`, `berlaku_mulai`, `berlaku_akhir`, `sumber_dana`, `kegiatan_terkait`, `pdki_url`, `unit_id`, `owner_id`, `workflow_status`, `extra` (JSON), `versi`, `locked`, `reread_count`, `submitted_at`, `validated_by`, `validated_at`, `deleted_at`.

**Jangan ada `tgl_sertifikat`.**

Unik nomor sertifikat **hanya** untuk terarsip belum dihapus, per `(jenis, no_sertifikat)` — di MySQL lewat generated `arsip_key`; di Postgres pakai **partial unique index**.

Tahun filter/laporan = tahun **`tgl_permohonan`**, bukan tahun unggah.

## 3. Enum & nilai persis

### Jenis HKI (`IpType`)

`hak_cipta`, `paten`, `paten_sederhana`, `merek`, `desain_industri`, `dtlst`, `rahasia_dagang`, `indikasi_geografis`, `pvt`

### Status HKI (substansi hukum di dokumen)

`permohonan`, `terdaftar`, `ditolak`, `ditarik`, `kedaluwarsa`

### Workflow

`DRAFT`, `EXTRACTING`, `EXTRACTION_FAILED`, `NEEDS_VERIFICATION`, `SUBMITTED`, `NEEDS_REVISION`, `REJECTED`, `ARCHIVED`, `CORRECTION_REQUESTED`

### Role aplikasi

`dosen`, `operator`, `validator`, `pimpinan`, `auditor`, `super_admin`

### Peran orang di dokumen

`pencipta`, `pemegang`, `kuasa`

### Status cocok orang

`disarankan`, `dikonfirmasi`, `ditolak`, `eksternal`, `ambigu`

### Review action

`ajukan`, `approve`, `request_revision`, `reject`, `minta_koreksi`

### Jenis berkas

`utama`, `lampiran`

### Tipe unit

`universitas`, `fakultas`, `prodi`

## 4. Field per jenis HKI

Field umum: `judul`, `no_permohonan`, `tgl_permohonan`, `no_sertifikat`, `status_hki` (+ `jenis`).

Field manual di kolom rekaman: `sumber_dana`, `kegiatan_terkait`, `pdki_url`.

Field khusus → JSON `extra`:

| Jenis | Field khusus |
|---|---|
| `hak_cipta` | `jenis_ciptaan`, `tanggal_pengumuman`, `tempat_pengumuman` |
| `paten`, `paten_sederhana` | `klasifikasi_ipc`, `data_prioritas` |
| `merek` | `kelas_nice`, `uraian_barang_jasa` |
| `desain_industri` | `klasifikasi_locarno`, `jumlah_tampilan` |
| `dtlst` | `tanggal_eksploitasi` |
| `rahasia_dagang` | `objek_pencatatan` |
| `indikasi_geografis` | `nama_ig`, `produk_ig` |
| `pvt` | `nama_varietas`, `pemulia` |

Field inti eskalasi AI: `judul`, `no_permohonan`, `tgl_permohonan`, `no_sertifikat`.

Kunci sistem di `extra` (bukan data UI): `ai_warnings`, `extraction_error`.

Skema AI versi: `v2` (tanpa `tgl_sertifikat`).

## 5. Master data seed

### `sumber_dana`

| nilai | label |
|---|---|
| `hibah_internal` | Hibah internal kampus |
| `bima_drtpm` | Hibah BIMA/DRTPM |
| `mandiri` | Mandiri |
| `kerja_sama` | Kerja sama / industri |

### `jenis_ciptaan` (UU 28/2014 Pasal 40 — 21 nilai)

`buku`, `karya_tulis`, `perwajahan_karya_tulis`, `program_komputer`, `basis_data`, `permainan_video`, `fotografi`, `potret`, `sinematografi`, `lagu_musik`, `drama`, `seni_rupa`, `arsitektur`, `peta`, `alat_peraga`, `ceramah`, `terjemahan`, `tafsir`, `saduran`, `bunga_rampai`, `karya_lainnya`

`nilai` master harus cocok `^[a-z0-9_]{1,80}$`. Item dinonaktifkan, tidak dihapus keras.

## 6. Pola nomor (soft warning)

Setelah buang spasi/strip/titik/garis miring (case-insensitive):

| Jenis | no_permohonan | no_sertifikat |
|---|---|---|
| hak_cipta | `^EC\d{2}\d{4}\d{4,8}$` | `^\d{6,12}$` |
| paten | `^P\d{2}\d{4}\d{4,8}$` | `^IDP\d{6,9}$` |
| paten_sederhana | `^S\d{2}\d{4}\d{4,8}$` | `^IDS\d{6,9}$` |
| merek | (tidak ada) | `^IDM\d{6,12}$` |
| desain_industri | `^A\d{2}\d{4}\d{4,8}$` | `^IDD\d{6,9}$` |

## 7. Masa berlaku (otomatis)

Dihitung ulang saat jenis / tgl_permohonan / tanggal_pengumuman / jenis_ciptaan berubah.

| Jenis | Aturan |
|---|---|
| paten | 20 tahun dari tgl_permohonan; akhir = mulai+N tahun−1 hari |
| paten_sederhana, merek, desain_industri | 10 tahun |
| hak_cipta (jenis tertentu + ada tanggal_pengumuman) | mulai 1 Jan tahun+1; akhir 31 Des tahun+50 (Pasal 59) |
| hak_cipta lain / tanpa tanggal | null → validator tetapkan |
| rahasia_dagang | mulai = tgl_permohonan; akhir null |
| IG, PVT, DTLST | null |

Jenis ciptaan dengan perlindungan 50 tahun (dinormalisasi underscore):  
`program_komputer`, `fotografi`, `sinematografi`, `permainan_video`, `basis_data`, `terjemahan`, `perwajahan_karya_tulis`, `potret`, `tafsir`, `saduran`, `bunga_rampai`.

Soft warning: `DATE_IN_FUTURE`, `PATTERN_MISMATCH`, `VALIDITY_UNKNOWN`, `AI_WARNING`.

## 8. Tingkat keyakinan field (UI)

Default ambang: high `0.85`, low `0.50` (bisa diubah admin).

- `ok` ≥ high
- `warn` antara low dan high
- `bad` < low atau null

Perlu konfirmasi sebelum ajukan jika keyakinan null/<high atau nilai AI null — kecuali sudah dikonfirmasi/diubah dosen.

## 9. Kolom ekspor

`No`, `Jenis HKI`, `Judul`, `Nomor Permohonan`, `Tanggal Permohonan`, `Nomor Sertifikat`, `Status HKI`, `Berlaku Mulai`, `Berlaku Sampai`, `Pencipta / Inventor`, `Pemegang Hak`, `Unit`, `Sumber Dana`, `Kegiatan Terkait`, `Tautan PDKI`, `Status Dokumen`, `Tanggal Diarsipkan`.

Label status dokumen ekspor: Draf, Dibaca AI, AI gagal, Perlu verifikasi, Menunggu validasi, Perlu revisi, Ditolak, Terarsip, Permintaan koreksi.

## 10. Batasan teknis sumber yang relevan

| Batas | Nilai |
|---|---|
| Ukuran berkas | 20 MB |
| Halaman PDF | 30 |
| Halaman ke model | 6 (pilih cerdas) |
| Baca ulang AI | 3 (default) |
| Alias nama | 20 |
| Rate unggah | 60/jam/user |
| Ekspor baris | 20.000 |
| Ekspor ZIP rekaman | 300 |
| Bulk approve | 1–100 id |
| Idle sesi API | 30 menit |
| Stale EXTRACTING | 6 menit → TIMEOUT |
| Segera berakhir | ≤ 180 hari |
