# Paket dokumen migrasi HAKI

Dokumen ini menangkap **seluruh proses bisnis** sistem sumber **Arsip HAKI Dosen** agar agent (dan manusia) bisa memasukkannya ke Sistem Akademik tanpa ada yang tertinggal.

## Sistem sumber

| | |
|---|---|
| Nama | Arsip HAKI Dosen |
| Path | `C:\Users\edyar\Downloads\app_haki` |
| Stack | Laravel 12 (PHP 8.2) + MySQL + Next.js 16 (static export di `public/`) |
| Inti | Unggah sertifikat HKI → AI isi draf → dosen verifikasi → validator Sentra KI/LPPM arsipkan |
| Login | Akun SIA (MySQL read-only) + peran lokal |
| AI | OpenRouter (klasifikasi + ekstraksi + eskalasi), halaman PDF dirender di browser |

Dokumen asli sumber (bukan pengganti paket ini): `README.md`, `ARSITEKTUR.md`, `DEPLOY.md` di folder `app_haki`.

## Sistem target

| | |
|---|---|
| Nama | Sistem Akademik |
| Path | repo ini (`amukancabbage.github.io`) |
| Stack | React + TypeScript + Vite + Supabase |
| Yang sudah ada | Penelitian, pengabdian, artikel mahasiswa, dosen, prodi, pengguna (`admin`/`dosen`/`pemantau`) |
| HKI saat ini | Belum diimplementasi (hanya contoh pola di README) |

## Urutan baca untuk agent

1. [`../AGENTS.md`](../../AGENTS.md) — misi & larangan
2. **File ini** — peta dokumen
3. [`GAP-DAN-PEMETAAN.md`](GAP-DAN-PEMETAAN.md) — apa yang harus dibangun vs apa yang sudah ada
4. [`PROSES-BISNIS.md`](PROSES-BISNIS.md) — alur lengkap
5. [`PERAN-AKSES.md`](PERAN-AKSES.md) + [`DOMAIN-DATA.md`](DOMAIN-DATA.md)
6. [`ATURAN-KRITIS.md`](ATURAN-KRITIS.md) — sebelum menyederhanakan apa pun
7. [`CHECKLIST.md`](CHECKLIST.md) — verifikasi kelengkapan

## Isi paket

| File | Fokus |
|---|---|
| `PROSES-BISNIS.md` | Lifecycle dokumen, AI, person linking, notifikasi, validasi, koreksi, ekspor, admin |
| `DOMAIN-DATA.md` | Tabel/entitas, enum, field per jenis HKI, master data, pola nomor, masa berlaku |
| `PERAN-AKSES.md` | 6 role sumber, cakupan unit, matriks aksi, mapping ke role target |
| `ATURAN-KRITIS.md` | 26+ aturan yang mudah hilang saat rewrite |
| `GAP-DAN-PEMETAAN.md` | Gap analysis + opsi arsitektur di Supabase |
| `CHECKLIST.md` | Daftar periksa “tidak ada yang tertinggal” |

## Prinsip migrasi

1. **Perilaku bisnis setara** dengan sumber, kecuali ada keputusan tertulis di `GAP-DAN-PEMETAAN.md`.
2. **Adaptasi teknis boleh** (Postgres/RLS/Storage/Edge Function menggantikan Laravel/MySQL/afterResponse).
3. **Jangan mengirimkan** fitur “belum ada di sumber” sebagai pengganti fitur yang ada — tandai sebagai keputusan baru.
4. **Verifikasi** ke kode/`tests/Feature` sumber bila dokumen dan implementasi bentrok; lalu perbarui dokumen.
