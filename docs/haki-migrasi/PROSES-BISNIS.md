# Proses bisnis lengkap — Arsip HAKI

Semua alur di bawah ini **wajib** punya padanan di sistem target (kecuali ditandai “keluar scope” di `GAP-DAN-PEMETAAN.md`).

---

## 1. Ringkasan produk

Dosen (atau operator atas nama dosen) mengunggah sertifikat HKI (PDF/foto). Sistem membaca dokumen dengan AI, mengisi draf metadata + daftar pencipta/pemegang. Dosen memverifikasi, mengonfirmasi field meragukan, menautkan pencipta ke dosen, lalu mengajukan. Validator Sentra KI/LPPM menyetujui (arsip), meminta revisi, atau menolak. Setelah terarsip, dosen dapat meminta koreksi. Pimpinan/auditor melihat dashboard & arsip; auditor melihat log audit; Super Admin mengelola pengguna, unit, master, dan konfigurasi AI.

---

## 2. Status workflow (`workflow_status`)

Nilai persis:

`DRAFT` → `EXTRACTING` → (`NEEDS_VERIFICATION` | `EXTRACTION_FAILED`) → … → `SUBMITTED` → (`ARCHIVED` | `NEEDS_REVISION` | `REJECTED`)

Juga: `CORRECTION_REQUESTED` (dari `ARCHIVED`).

### Transisi sah

| Aksi | Dari | Ke | Pelaku |
|---|---|---|---|
| `mulai_ekstraksi` | `DRAFT`, `NEEDS_VERIFICATION`, `NEEDS_REVISION`, `EXTRACTION_FAILED` | `EXTRACTING` | dosen, operator, validator |
| `ekstraksi_berhasil` | `EXTRACTING` | `NEEDS_VERIFICATION` | sistem |
| `ekstraksi_gagal` | `EXTRACTING` | `EXTRACTION_FAILED` | sistem |
| `isi_manual` | `DRAFT`, `EXTRACTION_FAILED` | `NEEDS_VERIFICATION` | dosen/operator (otomatis saat edit pertama / buat manual) |
| `ajukan` | `NEEDS_VERIFICATION`, `NEEDS_REVISION`, `CORRECTION_REQUESTED` | `SUBMITTED` | **dosen pemilik saja** |
| `setujui` | `SUBMITTED` | `ARCHIVED` | validator |
| `minta_revisi` | `SUBMITTED` | `NEEDS_REVISION` | validator |
| `tolak` | `SUBMITTED` | `REJECTED` | validator |
| `minta_koreksi` | `ARCHIVED` | `CORRECTION_REQUESTED` | dosen (pemilik atau pencipta dikonfirmasi) |

Transisi lain → ditolak (`INVALID_TRANSITION`).

### Boleh edit?

- Pemilik / operator unit: `DRAFT`, `NEEDS_VERIFICATION`, `NEEDS_REVISION`, `EXTRACTION_FAILED`, `CORRECTION_REQUESTED`
- Validator: `SUBMITTED`, `CORRECTION_REQUESTED`
- Tidak edit: `ARCHIVED`, `REJECTED`, `EXTRACTING`

### Boleh hapus? (soft delete)

Boleh: `DRAFT`, `NEEDS_VERIFICATION`, `NEEDS_REVISION`, `EXTRACTION_FAILED`, `REJECTED`

Tidak boleh:

- `EXTRACTING` — tunggu AI selesai
- `SUBMITTED` — hanya validator yang bisa kembalikan/tolak
- `ARCHIVED` — pakai minta koreksi
- `CORRECTION_REQUESTED` — sedang dikoreksi

Penghapusan: set `deleted_at`; notifikasi terkait dihapus; nomor sertifikat bebas lagi untuk arsip baru.

---

## 3. Lifecycle dokumen (inti)

### 3.1 Unggah sertifikat

**Siapa:** dosen, operator  
**Syarat:** sudah setujui pemberitahuan privasi; rate limit 60 berkas/jam/user.

1. Operator **wajib** pilih `on_behalf_of` (dosen di unitnya). Dosen biasa: atas nama sendiri.
2. Validasi berkas (magic bytes, bukan ekstensi):
   - Tipe: PDF, JPEG, PNG, HEIC
   - Maks 20 MB; tidak kosong
   - PDF: punya `%%EOF`, tidak terenkripsi, ≤ 30 halaman
3. Browser merender halaman PDF (pdf.js) → kirim `pages[]` + `meta` bersama berkas asli.
4. Buat rekaman: `owner_id` = dosen pemilik, `unit_id` = unit pemilik **saat unggah** (foto unit).
5. Simpan berkas `utama` + manifes `.prep.json` + gambar `.pN.jpg`.
6. Status → `EXTRACTING`; catat audit `record.upload`.
7. Info opsional: `duplicate_file_of` (SHA-256 sama) — **tidak memblokir**.
8. Dispatch pembacaan AI (setelah respons / background).

Batas sesi UI: 10 berkas per sesi unggah.

### 3.2 Rekaman manual (tanpa AI)

Dosen membuat rekaman kosong → langsung `NEEDS_VERIFICATION`. Berkas ditambah kemudian; berkas pertama = `utama`, berikutnya `lampiran`. Tidak ada pipeline AI otomatis.

### 3.3 Pembacaan AI

Tanpa OCR terpisah — vision LLM + teks lapisan PDF bila ada.

1. **Cache hash** (kecuali baca ulang): reuse hasil sukses untuk `sha256` + versi prompt + versi skema yang sama; hasil mock tidak di-cache.
2. **Anggaran bulanan** AI (jika > 0 dan terlampaui) → gagal `BUDGET_EXCEEDED` (cache tetap boleh).
3. **Klasifikasi** → `jenis_dokumen`, `jenis_hki`, kualitas gambar, jumlah sertifikat.
4. **Ekstraksi** terstruktur (JSON schema strict) per jenis HKI.
5. **Eskalasi** opsional ke model lebih kuat jika >30% field inti keyakinan < 0,5.
6. **Postprocess** deterministik: turunkan keyakinan untuk kosong/tanggal invalid/pola nomor/kutipan tidak ketemu.
7. Simpan ke field values + orang; status → `NEEDS_VERIFICATION`; notifikasi pemilik; notifikasi dosen `disarankan`.

Gagal / timeout (>6 menit stale saat daftar dibuka) → `EXTRACTION_FAILED` + kode alasan; dosen bisa “Baca ulang AI”.

Batas baca ulang: default 3. Baca ulang **menimpa** isian termasuk yang sudah diubah dosen; melewati cache; hanya dari status yang mengizinkan `mulai_ekstraksi` (bukan dari `SUBMITTED`).

### 3.4 Verifikasi dosen

- Edit field (`PATCH` + optimistic locking `versi` / `If-Match`)
- Autosave ~10 detik; peringatan keluar halaman
- Field kuning/merah (keyakinan rendah / kosong) **wajib** dikonfirmasi atau diubah sebelum ajukan
- Pratinjau dokumen: zoom, putar, lompat ke halaman sumber, “kembalikan nilai AI”
- Edit daftar pencipta/pemegang/kuasa; pilih dosen; cocokkan ulang
- Soft warnings: tanggal masa depan, pola nomor, masa berlaku tak terhitung, peringatan AI
- Cek duplikat (nomor / judul mirip)

### 3.5 Ajukan ke validator

**Hanya dosen pemilik** (`owner_id`). Body: pernyataan kebenaran dicentang.

Kelengkapan wajib (`SUBMISSION_INCOMPLETE` jika gagal):

- `jenis` HKI
- `judul`
- salah satu `no_permohonan` **atau** `no_sertifikat`
- ≥1 pencipta
- ≥1 pemegang
- berkas `utama`
- semua field “perlu konfirmasi” sudah dikonfirmasi/diubah dosen

Efek: `SUBMITTED`, `submitted_at`, `versi++`, snapshot versi, `ReviewAction=ajukan`, notifikasi validator berwenang, audit `record.submit`. Respons menyertakan `duplicates_total`.

### 3.6 Keputusan validator

Aksi: `approve` | `request_revision` | `reject`.

- Tolak → catatan wajib
- Minta revisi → catatan umum atau per field wajib
- Setujui → cek kelengkapan lagi; `UNCONFIRMED` **boleh** diloloskan validator; unik nomor sertifikat per jenis di arsip

Efek setuju: `ARCHIVED`, `locked=true`, `validated_by/at`, snapshot, notifikasi pemilik.

**Persetujuan massal** lebih ketat: harus `SUBMITTED`, ada data AI, tidak diubah manusia, keyakinan tinggi, tanpa soft warning, lengkap, tanpa duplikat. UI “layak setujui cepat” lebih longgar — **keputusan akhir di server**.

Alur antrean: filter di URL; konteks Sebelumnya/Berikutnya; otomatis buka dokumen berikutnya setelah keputusan; pintasan N/P/A/R/?.

### 3.7 Revisi & tolak

- `NEEDS_REVISION`: dosen perbaiki (lihat catatan validator) → ajukan lagi
- `REJECTED`: status akhir; hapus atau unggah baru

### 3.8 Koreksi arsip

Dari `ARCHIVED`, dosen pemilik **atau** pencipta dikonfirmasi, alasan ≥3 karakter → `CORRECTION_REQUESTED`, `locked=false`, snapshot arsip disimpan dulu, notifikasi validator. Kemudian edit + ajukan ulang + validator setujui lagi.

### 3.9 Riwayat

Timeline: dibuat/unggah → dibaca AI → ajukan → keputusan → koreksi, dll.

---

## 4. Penautan pencipta ↔ dosen

Peran orang: `pencipta` | `pemegang` | `kuasa`  
Status cocok: `disarankan` | `dikonfirmasi` | `ditolak` | `eksternal` | `ambigu`

Prinsip: **salah orang lebih buruk daripada tidak cocok.**

1. Normalisasi nama (buang gelar, ascii, lowercase).
2. Skor kemiripan token-sort; nama pendek (1 kata atau ≤12 huruf) harus skor 1,0; lainnya ≥0,90.
3. Beberapa kandidat sama kuat → utamakan pemilik dokumen → satu-satunya satu unit → selainnya `ambigu`.
4. Satu dosen tidak boleh dua penulis pada satu dokumen.
5. Pemilik boleh `link` manual (`link_manual`); bertahan saat rematch/edit/baca ulang AI.
6. Dosen `disarankan` mendapat notifikasi → halaman konfirmasi **tanpa** akses berkas/detail penuh.
7. Konfirmasi Ya → `dikonfirmasi` (baru boleh lihat dokumen). Tidak → `ditolak` + `person_rejections` (bertahan).
8. Alias nama dosen (maks 20) membantu pencocokan.

---

## 5. Notifikasi

In-app + email opsional (SMTP).

| Tipe | Pemicu | Penerima |
|---|---|---|
| `extraction_done` | AI sukses | pemilik |
| `extraction_failed` | AI gagal/timeout | pemilik |
| `submitted` | ajukan | validator berwenang |
| `review_approved` / `review_revision` / `review_rejected` | keputusan | pemilik |
| `person_suggested` | disarankan pencipta | dosen itu (tanpa judul di notif; tautan `/confirm`) |
| `person_claim` | Ya/Bukan saya | pemilik |
| `correction_requested` | minta koreksi | validator |

UI: lonceng + polling unread; tandai dibaca.

---

## 6. Berkas & pratinjau

- Stream lewat API (bukan URL publik mentah); audit `file.view`
- Halaman sebagai JPEG untuk penampil ponsel; PDF asli tetap tersedia
- Lampiran bisa dihapus; berkas `utama` tidak
- Antivirus: **belum ada** di sumber (kolom placeholder saja)

---

## 7. Duplikat

Untuk rekaman berjenis sama (belum dihapus):

- Nomor sertifikat sama (dinormalisasi) skor 1,0
- Nomor permohonan sama skor 1,0
- Judul mirip ≥0,90 + tahun `tgl_permohonan` sama (atau salah satu kosong)

`total` bisa lebih besar dari `items` yang boleh dilihat user.

---

## 8. Cari, filter, ekspor, dashboard

**Filter daftar:** q, jenis, tahun (`YEAR(tgl_permohonan)`), unit (+turunan), status, sumber dana, mine, keyakinan, umur antrean, sort, cursor.

**Ekspor:** CSV (BOM, anti formula-injection), XLSX (tanpa pustaka), ZIP berkas+manifest — dibatasi cakupan akses & batas baris (20k / 300 untuk ZIP).

**Dashboard (validator/pimpinan/auditor):** per status, per jenis/tahun/unit/sumber dana (arsip), antrean + umur, rata hari validasi, segera berakhir (≤180 hari).

**Portofolio dosen:** HKI terarsip milik sendiri, siap cetak/PDF.

**Log audit:** append-only; auditor + super_admin.

---

## 9. Admin & master

- Pengguna & peran (beri/cabut manual; stub user SIA sebelum login pertama)
- Unit hierarki: universitas / fakultas / prodi (anti siklus)
- Master: `sumber_dana`, `jenis_ciptaan` (nonaktifkan, jangan hard-delete nilai)
- Konfigurasi AI: model classify/extract/fallback/escalate, ambang keyakinan, anggaran bulanan, statistik biaya
- Privasi: accept notice wajib sebelum unggah

---

## 10. Login & identitas (sumber)

- SIA read-only; verifikasi hash (bcrypt/md5/sha1/sha256); tidak simpan password
- Hanya `dosen` / `operator` / `pimpinan` dari SIA
- `validator` / `auditor` / `super_admin` selalu manual
- Rate limit gagal login; pesan generik (anti enumerasi); SIA down → 503
- Dev login hanya non-produksi

> Di target: bisa diganti Supabase Auth + profiles, tetapi **matriks peran & cakupan** harus tetap dipenuhi (lihat `PERAN-AKSES.md` & `GAP-DAN-PEMETAAN.md`).

---

## 11. Halaman UI sumber (harus punya padanan UX)

| Halaman | Peran | Fungsi |
|---|---|---|
| Login | publik | SIA / dev |
| Beranda | dosen, operator | tugas + terbaru + banner saran pencipta |
| Unggah | dosen, operator | multi-file, kamera, atas nama, manual |
| HKI saya | dosen, operator | tab status, hapus |
| Detail dokumen | yang berhak | verifikasi / validasi / koreksi |
| Antrean | validator | filter + massal + konteks next |
| Arsip | banyak peran | filter + ekspor |
| Dashboard | validator, pimpinan, auditor | ringkasan |
| Portofolio | dosen | cetak |
| Konfirmasi pencipta | dosen | Ya / Bukan saya |
| Notifikasi | semua | daftar |
| Profil | semua | alias |
| Bantuan | semua | FAQ |
| Admin users/units/master/AI/audit | sesuai peran | kelola |

---

## 12. Fitur yang di sumber masih “belum ada”

Jangan diklaim sudah ada di sumber; kalau ditambah di target, catat sebagai **keputusan baru**:

- Antivirus (ClamAV)
- Signed URL berkas
- Status real-time (sekarang polling)
- Gabung duplikat otomatis
- Impor massal dokumen lama
- E2E Playwright
- DPIA formal transfer data ke AI luar negeri
