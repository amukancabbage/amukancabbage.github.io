# Catatan Lokal — Sistem Akademik

Catatan operasional untuk menjalankan project ini di komputer lokal.
Dokumentasi fitur & arsitektur lengkap ada di [`README.md`](README.md).

---

## Status setup (Nov 2026)

| Item | Status |
|---|---|
| Dependensi (`npm install`) | Sudah |
| File `.env` (gitignored) | Sudah, mengarah ke Supabase **lokal** |
| Migrasi database | Sudah (`supabase/migrations/20251106000000_init.sql`) |
| Stack Docker Supabase | Dipakai karena project cloud lama tidak bisa diakses |
| Akun lokal | Satu per peran (admin, 2 dosen, validator, operator, pemantau); lihat "Akun lokal" |
| Build production (`npm run build`) | Lulus |

> Project Supabase cloud `qdppqirobdaouttictpp.supabase.co` host-nya tidak resolve.
> Untuk development, pakai stack lokal di bawah ini.

---

## Prasyarat

1. **Node.js** (teruji: v22) + npm
2. **Docker Desktop** harus menyala
3. Dari folder project: `c:\laragon\www\amukancabbage.github.io`

---

## Menjalankan (setiap sesi kerja)

```bash
# 1. Pastikan Docker Desktop sudah running

# 2. Nyalakan Supabase lokal (API, DB, Auth, Studio)
npx supabase start

# 3. Nyalakan aplikasi
npm run dev
```

Lalu buka: **http://127.0.0.1:5173/**

### URL penting

| Layanan | URL |
|---|---|
| Aplikasi (Vite) | http://127.0.0.1:5173/ |
| Supabase API | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323/ |
| Database Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Mailpit (email lokal) | http://127.0.0.1:54324 |

### Akun lokal (satu per peran)

Hanya ada di Supabase lokal. Semua sudah dicek bisa login (2026-11-06).

| Email | Password | Role | Tertaut / cakupan | Dipakai untuk mencoba |
|---|---|---|---|---|
| `admin@local.test` | `admin123456` | admin | seluruh institusi | pengguna, unit, master, konfigurasi AI, log audit. Tidak melihat dokumen HKI (D5). |
| `dosen@local.test` | `test123456` | dosen | dosen "Dr. Muhammad Edya Rosadi, S.Kom., M.Kom." (Teknik Informatika) | unggah, isi metadata, ajukan, minta koreksi, portofolio |
| `dosen2@local.test` | `test123456` | dosen | dosen "Dr. Mirza Yogy Kurniawan, S.Kom., M.Kom." (Teknik Informatika) | konfirmasi/tolak sebagai pencipta di dokumen milik Edya |
| `validator@local.test` | `test123456` | validator | unit Fakultas Teknologi Informasi (beserta prodinya) | antrean, setujui/revisi/tolak, master HAKI, dashboard |
| `operator@local.test` | `test123456` | operator | unit Teknik Informatika | unggah atas nama dosen di unitnya (tidak bisa mengajukan) |
| `pemantau@local.test` | `test123456` | pemantau | seluruh institusi, baca saja | arsip HKI (hanya dokumen terarsip), data penelitian/pengabdian |

Data pendukung: dosen Edya (NIDN `0011223344`) dan Mirza (NIDN `0099887766`) di prodi Teknik Informatika, serta satu dokumen HKI terarsip "Aplikasi Uji Sistem Akademik" milik Edya. Di dokumen itu nama pencipta masih tertulis "Budi Santoso" dan "Siti Rahmawati": nama tertulis mengikuti isi sertifikat, sedangkan tautannya ke dosen tetap benar.

Akun selain admin dibuat lewat Auth admin API (`POST /auth/v1/admin/users` dengan service role key dari `npx supabase status`), lalu peran, `dosen_id`, dan `unit_id` diatur di tabel `public.profiles`. Semuanya **hilang** bila menjalankan `npx supabase db reset`; buat ulang dengan cara yang sama (lihat juga bagian "Membuat / memperbaiki akun admin").

Akun `*@tests.local` dipakai tes otomatis (`npm run test:db`) dan selalu di-rollback, jadi tidak pernah muncul di DB.

---

## Menghentikan

```bash
# Hentikan Vite: Ctrl+C di terminal npm run dev

# Hentikan container Supabase (data tetap tersimpan di volume Docker)
npx supabase stop
```

---

## File `.env`

File ini **tidak** ikut di-commit (ada di `.gitignore`). Isi untuk lokal:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Hanya untuk script import di komputer (jangan dipakai di frontend / Vercel)
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

Catatan:

- Key di atas adalah **default demo** Supabase lokal (sama untuk semua mesin yang pakai `supabase start`).
- Jangan pakai `SUPABASE_SECRET_KEY` / service role di frontend atau Environment Variables Vercel.
- Untuk production cloud, ganti URL + anon/publishable key dari dashboard Supabase project Anda.

Cek status & key terkini:

```bash
npx supabase status
```

---

## Database & migrasi

### File SQL edukatif (urutan README)

Masih ada di `supabase/*.sql` untuk dijalankan manual di SQL Editor cloud:

1. `schema.sql` — prodi, dosen
2. `penelitian.sql` — kategori, subkategori, penelitian
3. `auth.sql` — profiles, anggota, RLS
4. `tim-penelitian.sql` — created_by & hak penginput
5. `ketua-luar.sql` — ketua luar daftar dosen
6. `pengabdian.sql` — modul pengabdian
7. `beranda.sql` — RPC rekap
8. `hibah.sql` — kolom skema/biaya/anggota
9. `artikel-mahasiswa.sql` — artikel mahasiswa

### Migrasi CLI (yang dipakai lokal)

Semua file di atas digabung menjadi:

`supabase/migrations/20251106000000_init.sql`

Diterapkan otomatis saat `npx supabase start` / `npx supabase db reset`.

Reset database lokal (hapus data, ulang migrasi):

```bash
npx supabase db reset
```

Setelah reset, **buat ulang akun admin** (lihat bagian di bawah).

### Tabel yang harus ada

- `prodi`, `dosen`, `profiles`
- `kategori_penelitian`, `subkategori_penelitian`, `penelitian`, `penelitian_anggota`
- `kategori_pengabdian`, `subkategori_pengabdian`, `pengabdian`, `pengabdian_anggota`
- `artikel_mahasiswa`, `artikel_mahasiswa_dosen`

Seed awal: prodi **Teknik Informatika** dan **Sistem Informasi**.

---

## Membuat / memperbaiki akun admin

```bash
# Buat user (ganti password bila perlu)
# Pakai service role key dari `npx supabase status` atau .env

# PowerShell contoh:
$service = "<SERVICE_ROLE_KEY>"
$body = @{ email = "admin@local.test"; password = "admin123456"; email_confirm = $true } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:54321/auth/v1/admin/users" `
  -Headers @{ Authorization = "Bearer $service"; apikey = $service; "Content-Type" = "application/json" } `
  -Body $body

# Jadikan admin
npx supabase db query "update public.profiles set role = 'admin' where email = 'admin@local.test';"
```

Atau lewat Studio: http://127.0.0.1:54323 → Authentication → Users, lalu update `profiles.role` di SQL Editor.

---

## Script import (opsional)

```bash
# Dry run dulu
npm run import:dosen -- data/dosen.csv --dry-run
npm run import:kegiatan -- data/kegiatan.csv --dry-run

# Jalankan sungguhan
npm run import:dosen -- data/dosen.csv
npm run import:kegiatan -- data/kegiatan.csv
```

Syarat: `SUPABASE_SECRET_KEY` di `.env`, file CSV di folder `data/` (gitignored).
Rincian kolom CSV: lihat README tahap 10 & 15.

---

## Modul HAKI: ekstraksi AI

Alur manual HAKI berjalan tanpa AI. Ekstraksi otomatis hanya aktif bila **Konfigurasi AI HAKI → Aktifkan pembacaan AI** dicentang **dan** Edge Function `haki-extract` punya `OPENROUTER_API_KEY`.

Kunci API **hanya** di `supabase/functions/.env` (lokal, gitignored) atau secret Edge Function (cloud). Jangan pernah masuk `VITE_` / frontend.

### Mode tiruan (tanpa biaya, untuk mencoba alur)

Terminal 1 — server tiruan OpenRouter:

```powershell
npm run mock:ai
```

`supabase/functions/.env` (sudah diabaikan git):

```
OPENROUTER_BASE_URL=http://host.docker.internal:9999/v1
OPENROUTER_API_KEY=mock
```

Terminal 2 — Edge Function:

```powershell
npx supabase functions serve haki-extract --env-file supabase/functions/.env
```

Lalu di UI: admin mengaktifkan AI, dosen mengunggah sertifikat. Jawaban tiruan selalu sama (bukan hasil baca gambar). Job bertanda `mock = true` tidak di-cache dan tidak masuk biaya bulanan.

Galat paksa (ganti `OPENROUTER_API_KEY` atau `GET http://127.0.0.1:9999/__force?key=...`): `tolak-401`, `habis-402`, `limit-429`, `rusak-500`, `json-rusak`.

### Mode sungguhan (lokal)

1. Di `supabase/functions/.env` hapus `OPENROUTER_BASE_URL` dan isi `OPENROUTER_API_KEY=sk-or-...`
2. Restart `npx supabase functions serve haki-extract --env-file supabase/functions/.env`
3. Cek penyedia ZDR: `npm run uji:ai -- --probe`
4. Ukur 10 sertifikat contoh app_haki (laporan ke `data/`, gitignored):

```powershell
npm run uji:ai -- --kunci          # kunci jawaban dari MySQL haki_php_dev, bila menyala
npm run uji:ai                     # atau --limit 3
```

### Peluncuran AI di cloud

Prasyarat: project cloud reachable, migrasi HAKI (sampai `20261106010400_haki_null_guards.sql`) sudah `db push`.

```powershell
npx supabase secrets set OPENROUTER_API_KEY=sk-or-...
npx supabase functions deploy haki-extract
```

Di **Konfigurasi AI HAKI** (cloud):

1. Isi `ai.monthly_budget_usd` dengan angka nyata (jangan 0 = tanpa batas).
2. Biarkan **Aktifkan pembacaan AI** mati sampai uji asap lulus.
3. Uji asap: satu sertifikat, cek `hki_extraction_jobs` (`mock` harus false, biaya dan model terisi), lalu statistik di halaman admin.
4. Baru kemudian centang **Aktifkan pembacaan AI**.

**Darurat — matikan AI segera:** di Konfigurasi AI HAKI, lepas centang **Aktifkan pembacaan AI**, lalu Simpan. Unggah baru tidak memanggil model; dokumen yang sedang `EXTRACTING` disapu jadi `TIMEOUT` setelah `ai.stale_minutes`. Secret OpenRouter tidak perlu dihapus.

- Bucket Storage `haki-files` privat; berkas hanya bisa dibaca pemilik (atau operator unitnya), pencipta terkonfirmasi, validator unit, dan pemantau (arsip saja).
- Admin **tidak** melihat dokumen HKI (D5); admin hanya mengelola pengguna, unit, master, pengaturan AI, dan log audit.
- Batas unggah 60 berkas/jam per pengguna; ekstraksi dibatasi `ai.monthly_budget_usd` (0 = tanpa batas).

---

## Perintah berguna

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Dev server Vite |
| `npm run build` | Typecheck + build production ke `dist/` |
| `npm run preview` | Preview hasil build |
| `npm run lint` | Oxlint |
| `npm run test:db` | Tes pgTAP hak akses HAKI per peran + alur AI (Supabase lokal harus jalan) |
| `npm run test:fn` | Tes Deno logika murni ekstraksi/pencocokan nama |
| `npm run mock:ai` | Server tiruan OpenRouter di port 9999 |
| `npm run uji:ai` | Probe ZDR / unggah sertifikat contoh dan tulis `data/hasil-uji-ai.csv` |
| `npx supabase start` | Nyalakan stack lokal |
| `npx supabase stop` | Matikan stack lokal |
| `npx supabase status` | URL & key |
| `npx supabase db reset` | Reset DB + ulang migrasi |
| `npx supabase db query "..."` | Jalankan SQL ke DB lokal |

---

## Keamanan singkat

- Matikan **Allow new users to sign up** di project **cloud** production (lihat README tahap 9b).
- Frontend hanya boleh pakai anon/publishable key.
- Secret/service role hanya di mesin lokal / script server-side.
- Hak akses sebenarnya ada di **RLS** database, bukan hanya di UI.
- Jangan commit `.env`, `data/`, atau `hasil-import*.csv`.

---

## Troubleshooting

| Gejala | Perbaikan |
|---|---|
| `failed to connect to the docker API` | Nyalakan Docker Desktop, tunggu sampai ready, lalu `npx supabase start` lagi |
| Login gagal / profil tidak ditemukan | Cek `npx supabase status`; pastikan migrasi jalan; buat ulang admin |
| Vite error `Unused args` | Jangan `npm run dev -- --host ...` tanpa `=`; pakai `npx vite --host 127.0.0.1 --port 5173` atau cukup `npm run dev` |
| Data hilang setelah `db reset` | Normal; import ulang / buat admin lagi |
| Mau balik ke Supabase cloud | Isi `.env` dengan URL + anon key cloud; pastikan semua SQL README sudah dijalankan di project itu |

---

## Ringkasan arsitektur (ingat cepat)

- **Stack:** React 19 + TypeScript + Vite + Supabase (Auth + Postgres + RLS)
- **Router:** `HashRouter` (`/#/beranda`) agar aman di hosting statis
- **Role:** `admin` · `dosen` · `pemantau`
- **Komponen inti:** `CrudPage` (CRUD generik), `KegiatanPage` (penelitian/pengabdian + tim)
- **Menu/routing:** `src/menu.tsx` (filter per role)
- **Deploy cloud:** Vercel + env `VITE_SUPABASE_*` (bukan secret key)

Prioritas utang teknis (dari analisis): migrasi terversioning untuk cloud, CI (`build`+lint), pecah `CrudPage`, hardening pencarian.
