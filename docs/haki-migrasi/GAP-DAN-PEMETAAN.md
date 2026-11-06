# Gap analysis & pemetaan ke Sistem Akademik

## 1. Ringkasan gap

| Area | Sistem Akademik (sekarang) | Arsip HAKI (sumber) | Gap |
|---|---|---|---|
| Domain | Penelitian, pengabdian, artikel | Sertifikat HKI + workflow validasi | **Modul baru besar** |
| Role | admin, dosen, pemantau | 6 role + cakupan unit | Perlu perluasan role/RLS |
| Unit | `prodi` datar | hierarki units | Model organisasi |
| File | URL eksternal saja | upload + storage + preview halaman | Storage + viewer |
| AI | tidak ada | OpenRouter pipeline | Integrasi AI + job |
| Workflow | CRUD langsung “hidup” | 9 status + transisi ketat | State machine |
| Person matching | tim dosen checkbox | fuzzy match + konfirmasi | Domain PersonMatcher |
| Notifikasi | tidak ada | in-app + email | Modul baru |
| Audit | tidak ada | append-only log | Modul baru |
| Ekspor | tidak ada | CSV/XLSX/ZIP | Modul baru |
| Auth | Supabase email/password | SIA read-only (+dev) | Keputusan integrasi SIA |
| Stack data | Postgres/Supabase | MySQL-specific SQL | Adaptasi partial index, dll. |

Kesimpulan: **HAKI tidak bisa diganti dengan satu `KegiatanPage`.** Pola kegiatan hanya mencakup sebagian kecil (judul, tahun, tim, skema). Workflow, berkas, AI, validasi, dan person-linking adalah inti produk HAKI.

## 2. Apa yang bisa dipakai ulang di target

| Aset target | Dipakai untuk |
|---|---|
| `profiles` + role + `dosen_id` | basis identitas; perlu diperluas |
| Tabel `dosen`, `prodi` | seed pencipta / unit awal |
| `AuthProvider`, login page | sesi; mungkin tambah role |
| `CrudPage` | master data HAKI (jenis ciptaan, sumber dana, units sederhana) |
| `menu.tsx` | daftar menu HAKI per role |
| Pola RLS + helper SQL | policy HAKI |
| Supabase Storage | ganti disk `haki-files` |
| Edge Functions / queue | ganti `afterResponse` AI |
| Import CSV scripts | opsional impor arsip lama (fitur sumber belum ada) |

## 3. Opsi arsitektur (belum dipilih — butuh keputusan manusia)

### Opsi A — Modul HAKI penuh di dalam Sistem Akademik ✅ DIPILIH (D1, 2026-11-06)

Satu app, menu grup “HAKI / Kekayaan Intelektual”, tabel + RLS baru, Storage, Edge Function AI.

- **Pro:** satu login, satu beranda institusi, data dosen bersama  
- **Contra:** kompleksitas role & UI melonjak; CrudPage tidak cukup untuk layar dokumen

### Opsi B — Subsistem terpisah, SSO ke Supabase yang sama

App HAKI tetap pola sendiri, share Auth/DB.

- **Pro:** isolasi kompleksitas  
- **Contra:** dua frontend; risiko drift identitas

### Opsi C — MVP subset dulu

Urutan MVP yang masih “jujur” terhadap bisnis (jangan sebut selesai penuh):

1. Unggah + metadata manual + status sederhana (DRAFT → SUBMITTED → ARCHIVED) tanpa AI  
2. Role validator + antrean  
3. Baru AI + person matching + koreksi + ekspor  

Setiap tahap harus memperbarui `CHECKLIST.md` (centang hanya yang benar-benar ada).

## 4. Pemetaan teknis MySQL → Supabase/Postgres

| Sumber | Target |
|---|---|
| `arsip_key` generated + unique | `UNIQUE (jenis, no_sertifikat) WHERE workflow_status='ARCHIVED' AND deleted_at IS NULL` |
| Trigger audit no update/delete | trigger Postgres + revoke UPDATE/DELETE |
| `YEAR(tgl_permohonan)` | `extract(year from tgl_permohonan)` |
| `afterResponse` AI | Edge Function + `pg_net` / queue / trigger status |
| Disk lokal berkas | Supabase Storage bucket private |
| Session cookie Laravel | Supabase Auth JWT (sudah ada) |
| SIA MySQL | Foreign data / sync berkala / tetap login lokal dulu |
| UUID v7 | `uuidv7()` extension atau generate di app |
| Soft delete manual | `deleted_at` + policy `deleted_at is null` |

## 5. Layar / komponen baru yang dibutuhkan di target

Minimal (setara sumber):

- Unggah multi-berkas + privacy modal + on_behalf  
- Daftar “HKI saya” bertab status  
- Layar dokumen (viewer + form field + persons + aksi workflow) — **bukan CrudPage**  
- Antrean validator + bulk  
- Arsip + ekspor  
- Dashboard ringkas  
- Konfirmasi pencipta  
- Notifikasi  
- Portofolio  
- Admin: users/roles/units/master/AI/audit (sebagian bisa CrudPage)

## 6. Keputusan terbuka (isi saat disetujui)

Gunakan bagian ini untuk mencatat keputusan manusia. Agent **jangan mengarang** jawaban.

| ID | Pertanyaan | Keputusan | Tanggal |
|---|---|---|---|
| D1 | Opsi arsitektur A / B / C? | **A** — modul HAKI penuh di dalam Sistem Akademik (satu app, menu grup HAKI, tabel+RLS+Storage+AI di Supabase yang sama) | 2026-11-06 |
| D2 | Perluas role ke 6, atau subset? | **Subset 4 role:** `admin` + `dosen` + `validator` + `operator`. Tidak mengadopsi `pimpinan` / `auditor` sebagai role terpisah di v1. | 2026-11-06 |
| D3 | Integrasi SIA sekarang atau nanti (Supabase-only dulu)? | **Supabase Auth saja di v1.** Tanpa login SIA. Daftar dosen = tabel `dosen` (berperan sebagai "direktori SIA" untuk pencocokan pencipta). | 2026-11-06 |
| D4 | AI OpenRouter wajib di v1 atau manual-first? | **Manual + workflow dulu, AI fase tersendiri.** Status `EXTRACTING` ada sejak schema. AI aktif bila `hki_settings.ai.enabled = true` dan secret `OPENROUTER_API_KEY` terpasang di Edge Function; jika mati, unggah langsung ke `NEEDS_VERIFICATION`. | 2026-11-06 |
| D5 | Apakah `admin` sistem akademik = `super_admin` HAKI (tanpa lihat semua dokumen)? | **Ya.** `admin` = super_admin: kelola pengguna/unit/master/AI/audit, **tidak** otomatis melihat dokumen HKI. | 2026-11-06 |
| D6 | `pemantau` di HAKI? | **Tetap** di sistem; di HAKI = baca arsip saja (mirip pimpinan, tanpa batasan unit). Tidak edit/unggah/validasi. Penelitian/pengabdian/artikel: perilaku lama (lihat semua, tanpa edit). | 2026-11-06 |
| D7 | Impor data dari app_haki production? | **Tidak** dalam rencana ini. | 2026-11-06 |
| D8 | Email notifikasi (SMTP/Resend) di v1? | **Tidak.** Notifikasi in-app saja; email ditunda. | 2026-11-06 |
| D9 | Pengujian otomatis? | Awalnya ditunda; kini ada tes pgTAP per peran + alur AI (`supabase/tests/database/`, `npm run test:db`, 151 asersi) dan tes Deno logika murni (`npm run test:fn`). Tes UI/E2E belum ada. | 2026-11-06 |

### Catatan implementasi v1 (mengikuti plan yang disetujui, 2026-11-06)

Bukan keputusan bisnis baru; ini cara plan diterapkan dan apa yang sengaja ditunda. Ubah hanya dengan persetujuan manusia.

| # | Topik | Penerapan |
|---|---|---|
| D10 | Antivirus berkas unggahan | Ditunda. Mitigasi v1: bucket privat, whitelist MIME, cek magic byte, batas 20 MB. |
| D11 | Peran auditor terpisah | Ditunda. Log audit dibaca admin; admin tetap tidak melihat isi dokumen (D5). |
| D12 | Pencocokan nama pencipta | Fuzzy match dijalankan di klien (`src/haki/personMatch.ts`, berbagi kode dengan Edge Function); server tetap menentukan status akhir (pemilik = dikonfirmasi, penolakan → ambigu, satu dosen satu slot per peran). |
| D13 | Validasi jenis berkas | Magic byte, jumlah halaman, PDF terenkripsi/korup diperiksa di klien; server memaksa MIME, ukuran, path `records/<uuid>/`, satu berkas utama, dan rate limit 60/jam. |
| D14 | Statistik AI untuk admin | Admin hanya melihat agregat biaya/jumlah panggilan AI (`hki_ai_stats`), tanpa judul atau isi dokumen. |
| D15 | Data SIA, email, impor | Tidak dibangun di v1 sesuai D3 (Supabase Auth), D8 (in-app), D7 (tanpa impor). |
| D16 | Model AI, tenggat, akurasi | Disamakan dengan bawaan app_haki (`config/haki.php`): klasifikasi/ekstraksi `google/gemini-3.1-flash-lite` (ZDR OK), cadangan `openai/gpt-6-luna`, eskalasi `anthropic/claude-sonnet-5.5`. Cadangan/eskalasi belum punya endpoint ZDR+structured output; jalur utama Gemini. Tenggat 120 dtk / 40 dtk per panggilan; `waitUntil` 202. Uji 8 sampel berhalaman (2026-11-06, `data/hasil-uji-ai.csv`): 8/8 tidak macet EXTRACTING, `mock=false`, biaya ~$0,02. Dua dokumen yang benar-benar berisi data sertifikat (PDF digital + satu sertifikat DJKI sungguhan) field inti benar; enam lainnya adalah halaman pengisi tes app_haki tanpa metadata HKI di gambar, jadi kosong/rendah adalah hasil yang wajar. |

## 7. Urutan implementasi yang disarankan (setelah D1–D4)

1. Domain SQL: units/roles/records/persons/files/fields/reviews/versions/audit/notifications/master + RLS  
2. Perluas auth/profiles/menu  
3. Unggah Storage + metadata manual + workflow dasar  
4. Layar dokumen + ajukan/validasi  
5. Person linking  
6. AI pipeline  
7. Antrean massal, dashboard, ekspor, portofolio, notifikasi  
8. Admin AI/audit + hardenin
g  
9. Migrasi data (jika D7) + uji checklist
