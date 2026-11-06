# Panduan Agent — Sistem Akademik + Integrasi HAKI

Baca file ini **sebelum** mengubah kode terkait HAKI / kekayaan intelektual / arsip sertifikat.

## Misi proyek

Memindahkan **semua proses bisnis** dari sistem sumber **Arsip HAKI Dosen**
(`C:\Users\edyar\Downloads\app_haki`) ke dalam sistem ini
(`amukancabbage.github.io` — React + TypeScript + Vite + Supabase).

Sistem target saat ini mengelola penelitian, pengabdian, artikel mahasiswa, dosen, prodi, dan pengguna
(3 role: `admin` / `dosen` / `pemantau`). Modul HKI **belum ada** (README hanya menyebut contoh pola
`KegiatanPage`). Integrasi HAKI **bukan** salinan CRUD sederhana: ada workflow status, unggah berkas,
pembacaan AI, validasi Sentra KI, pencocokan pencipta, notifikasi, ekspor, dan audit.

## Sumber kebenaran (wajib dibaca sesuai tugas)

| Dokumen | Isi |
|---|---|
| [`docs/haki-migrasi/README.md`](docs/haki-migrasi/README.md) | Indeks + cara memakai paket dokumen |
| [`docs/haki-migrasi/PROSES-BISNIS.md`](docs/haki-migrasi/PROSES-BISNIS.md) | Semua alur kerja end-to-end |
| [`docs/haki-migrasi/DOMAIN-DATA.md`](docs/haki-migrasi/DOMAIN-DATA.md) | Entitas, enum, field, master data |
| [`docs/haki-migrasi/PERAN-AKSES.md`](docs/haki-migrasi/PERAN-AKSES.md) | Role, cakupan unit, matriks aksi |
| [`docs/haki-migrasi/ATURAN-KRITIS.md`](docs/haki-migrasi/ATURAN-KRITIS.md) | Aturan mudah terlewat (jangan disederhanakan sembarangan) |
| [`docs/haki-migrasi/GAP-DAN-PEMETAAN.md`](docs/haki-migrasi/GAP-DAN-PEMETAAN.md) | Gap vs sistem akademik + opsi pemetaan |
| [`docs/haki-migrasi/CHECKLIST.md`](docs/haki-migrasi/CHECKLIST.md) | Checklist kelengkapan (centang sebelum klaim selesai) |
| [`CATATAN-LOKAL.md`](CATATAN-LOKAL.md) | Menjalankan sistem akademik di lokal |
| [`README.md`](README.md) | Fitur & konvensi sistem akademik yang sudah ada |

Kode sumber HAKI (bila perlu verifikasi perilaku): `C:\Users\edyar\Downloads\app_haki\`
— utamanya `app/Domain`, `app/Services`, `routes/api.php`, `database/migrations`, `resources/frontend/app`.

## Aturan kerja agent

1. **Jangan mengklaim modul HAKI selesai** tanpa mencentang item relevan di `CHECKLIST.md`.
2. **Jangan menghapus / menggabungkan status workflow** tanpa dokumen keputusan tertulis di `docs/`.
3. **Jangan menambah field `tgl_sertifikat`** — disengaja tidak ada di sumber (Surat Pencatatan Ciptaan DJKI tidak mencetaknya).
4. **Hak akses ditegakkan di database (RLS / policy)**, bukan hanya di UI — mengikuti pola sistem akademik.
5. **Proses bisnis sumber adalah spesifikasi**; adaptasi stack (Supabase vs Laravel/MySQL) boleh, perilaku bisnis harus setara kecuali ada keputusan eksplisit di `GAP-DAN-PEMETAAN.md`.
6. Pola `KegiatanPage` **tidak cukup** untuk HAKI penuh (lihat gap analisis).
7. Bila ragu, buka `ATURAN-KRITIS.md` dulu, lalu verifikasi di kode `app_haki`.

## Keputusan terkunci (lihat GAP-DAN-PEMETAAN.md §6)

- D1 Opsi A: modul HAKI penuh di dalam sistem ini
- Role: `admin` (= super_admin, tidak otomatis lihat dokumen HKI), `dosen`, `validator`, `operator`, `pemantau` (HAKI: baca arsip saja)
- Supabase Auth saja (tanpa SIA); tabel `dosen` = direktori pencipta
- AI OpenRouter opsional via `hki_settings.ai.enabled` + secret Edge Function
- Notifikasi in-app saja; tanpa impor data lama
- Tes pgTAP per peran + alur AI wajib tetap lulus (`npm run test:db`); logika murni `npm run test:fn`; tes UI/E2E belum ada

## Peta kode HAKI

- SQL: `supabase/migrations/2026110601*_haki_*.sql` (semua aksi workflow lewat RPC `hki_*` security definer)
- Frontend: `src/haki/` (logika), `src/components/haki/`, `src/pages/haki/`
- AI: `supabase/functions/haki-extract/`, logika murni bersama di `supabase/functions/_shared/`
- Tes: `supabase/tests/database/<peran>.test.sql` + `ai.test.sql` + fixture `_fixtures.psql` (`\ir`, di-rollback). Deno: `supabase/functions/_shared/*.test.ts`. Ubah RLS/RPC → tambah asersi untuk peran yang terdampak.

## Stack target (sistem ini)

- Frontend: React 19 + TS + Vite + HashRouter + `CrudPage` / `KegiatanPage`
- Backend: Supabase (Auth, Postgres, RLS, Storage, Edge Functions bila perlu)
- Lokal: lihat `CATATAN-LOKAL.md` (`npx supabase start` + `npm run dev`)
