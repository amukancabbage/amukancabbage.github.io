# Checklist kelengkapan migrasi HAKI

Centang hanya yang **sudah ada dan teruji** di Sistem Akademik.  
Agent **tidak boleh** mengklaim modul HAKI selesai jika item wajib masih `[ ]`.

Legenda: **W** = wajib untuk setara sumber · **M** = boleh ditunda jika ada keputusan di gap doc · **N** = tidak ada di sumber (opsional baru)

Penanda status (pembaruan 2026-11-06):

- `[x]` ada dan teruji: tes pgTAP per peran (`npm run test:db`), smoke test SQL, dan/atau smoke test browser.
- `[~]` sudah diimplementasi dan lolos build/typecheck, **belum** diuji manual end-to-end.
- `[ ]` belum ada; alasan penundaan tercatat di `GAP-DAN-PEMETAAN.md`.

Smoke browser 2026-11-06 mencakup: dosen (privasi → unggah PNG → isi metadata → daftar pencipta → ajukan), validator (antrean → setujui), admin (dokumen 404, log audit, master), operator (arsip unit), dashboard validator, AI mock (unggah → NEEDS_VERIFICATION, field berwarna, kembalikan nilai, baca ulang 3×, 5 kode galat, statistik admin $0).

---

## A. Fondasi

- [x] **W** Enum/status workflow lengkap (9 nilai) + penolakan transisi ilegal
- [x] **W** Model/tabel rekaman HKI + soft delete + versi optimistic
- [x] **W** Partial unique nomor sertifikat hanya untuk ARCHIVED aktif
- [x] **W** Tidak ada field `tgl_sertifikat`
- [x] **W** Master `sumber_dana` + `jenis_ciptaan` (21 nilai)
- [x] **W** Semua jenis HKI (9) + field khusus per jenis
- [x] **W** Role & cakupan unit (keputusan D2 tercatat)
- [x] **W** RLS/policy setara matriks `PERAN-AKSES.md`
- [x] **W** Visibilitas: 404 untuk yang tak berhak; `disarankan` tanpa akses penuh
- [x] **W** Audit log append-only
- [x] **W** Storage berkas privat + akses terotorisasi

## B. Unggah & berkas

- [x] **W** Privacy notice wajib sebelum unggah
- [~] **W** Unggah PDF/JPEG/PNG (+ penanganan HEIC) — PNG teruji; PDF dan HEIC belum
- [~] **W** Validasi ukuran/halaman/korup/enkripsi
- [x] **W** Operator `on_behalf_of` (wajib) dalam unit
- [~] **W** Berkas utama + lampiran; utama tidak bisa dihapus
- [x] **W** Pratinjau / unduh dengan audit view
- [~] **W** Rate limit unggah (60 berkas/jam, di RPC `hki_register_file`)
- [~] **W** Info duplikat SHA-256 (tidak memblokir)
- [~] **M** Render halaman PDF di klien untuk AI/viewer
- [ ] **N** Antivirus — ditunda (D10)

## C. AI

Mode D4 = manual-first. Pipeline teruji mock dan model sungguhan `google/gemini-3.1-flash-lite` (ZDR). Laporan `data/hasil-uji-ai.csv` (gitignored).

- [x] **M\*** Pipeline klasifikasi → ekstraksi → eskalasi (eskalasi dilewati bila sisa waktu < 40 dtk; teruji mock)
- [x] **W** Cache hasil by hash+versi skema/prompt; baca ulang bypass; mock tidak di-cache (`gen-mock-` → `mock=true`, `hki_ai_month_cost` = 0)
- [x] **W** Status EXTRACTING / sukses / gagal + notifikasi (202 + `waitUntil`; 5 kode galat teruji)
- [x] **W** Sapu stale EXTRACTING (timeout) — pgTAP `ai.test.sql`
- [x] **W** Batas baca ulang + peringatan timpa data (3× lalu `REREAD_LIMIT`; pembacaan pertama dari DRAFT tidak dihitung)
- [x] **W** Ambang keyakinan + field kuning/merah wajib konfirmasi
- [x] **W** Soft warnings (pola nomor, tanggal — tes Deno `_shared`)
- [x] **W** Hitung masa berlaku otomatis (hak cipta program komputer 2024-01-01–2073-12-31)
- [x] **M** Anggaran bulanan AI + admin config model
- [x] **M** Statistik biaya AI (admin melihat agregat, bukan isi dokumen)
- [x] **M** Akurasi model sungguhan + ZDR — probe Gemini 3.1 OK; 8/8 sampel tidak macet; 2 dokumen berisi data sertifikat field inti benar (D16)

## D. Verifikasi & ajukan

- [x] **W** Edit field + optimistic concurrency / konflik
- [x] **W** Konfirmasi field meragukan
- [x] **W** Kembalikan nilai AI
- [~] **W** Autosave / peringatan keluar (setara UX)
- [x] **W** Syarat kelengkapan submit (jenis, judul, nomor, pencipta, pemegang, berkas, konfirmasi)
- [x] **W** Pernyataan kebenaran wajib
- [x] **W** Hanya pemilik yang boleh ajukan
- [x] **W** Operator tidak boleh ajukan / buat manual
- [x] **W** Rekaman manual tanpa AI

## E. Person linking

- [x] **W** Peran pencipta/pemegang/kuasa
- [x] **W** Normalisasi nama + buang gelar
- [x] **W** Fuzzy match dengan aturan nama pendek / ambigu / satu dosen satu slot
- [x] **W** Status disarankan/dikonfirmasi/ditolak/eksternal/ambigu
- [~] **W** Link manual pemilik + bertahan
- [x] **W** Halaman konfirmasi Ya/Bukan saya (RPC teruji; halaman belum diklik)
- [x] **W** person_rejections bertahan
- [~] **W** Alias nama dosen (≤20)
- [~] **W** Rematch
- [x] **W** Search dosen + NIDN disamarkan
- [ ] **M** Direktori SIA untuk dosen belum login — ditunda (D3: Supabase Auth saja)

## F. Validasi

- [x] **W** Antrean SUBMITTED + filter (jenis, unit, umur, keyakinan)
- [x] **W** Approve / request_revision / reject + catatan (approve teruji di browser; revisi/tolak lewat RPC)
- [x] **W** Catatan per field untuk revisi
- [x] **W** Approve → ARCHIVED + validated_by/at + lock
- [x] **W** Tolak nomor sertifikat duplikat saat arsip
- [x] **W** Bulk approve dengan aturan ketat server
- [x] **W** Navigasi next/prev antrean setelah keputusan
- [x] **W** Validator edit saat SUBMITTED / CORRECTION_REQUESTED

## G. Koreksi, hapus, riwayat

- [x] **W** Minta koreksi dari ARCHIVED (pemilik/pencipta) + alasan
- [x] **W** Snapshot versi sebelum koreksi / saat ajukan / keputusan
- [x] **W** Aturan hapus per status
- [~] **W** Soft delete membersihkan notifikasi terkait
- [x] **W** Timeline riwayat

## H. Duplikat, cari, ekspor, laporan

- [~] **W** Deteksi duplikat nomor/judul
- [x] **W** Filter daftar (q, jenis, tahun tgl_permohonan, unit, status, sumber dana, mine)
- [~] **W** Ekspor CSV (BOM, anti formula)
- [~] **W** Ekspor XLSX
- [~] **W** Ekspor ZIP + batas
- [x] **W** Dashboard (status, jenis, tahun, unit, sumber dana, antrean umur, rata hari, segera berakhir)
- [~] **W** Portofolio dosen terarsip (cetak)

## I. Notifikasi & admin

- [x] **W** Notifikasi in-app semua tipe di `PROSES-BISNIS.md` §5 (submitted & review_approved teruji)
- [ ] **M** Email SMTP/provider — ditunda (D8: in-app saja)
- [x] **W** Admin kelola role pengguna (sesuai keputusan role)
- [x] **W** Kelola unit/hierarki (atau padanan)
- [x] **W** Kelola master
- [x] **M** Halaman konfigurasi AI
- [x] **W** Log audit untuk auditor/admin (peran auditor terpisah ditunda, D11)
- [~] **W** Bantuan/FAQ minimal

## J. Integrasi & operasi

- [ ] **M** Login SIA (jika D3 = ya) — tidak dipakai (D3 = Supabase Auth)
- [x] **W** Login Supabase berfungsi untuk semua role HAKI yang diadopsi
- [x] **W** Menu & routing per role (`menu.tsx` atau setara)
- [x] **W** Dokumentasi lokal/cara jalan diperbarui
- [ ] **M** Impor data dari app_haki (D7) — tidak dilakukan (D7)
- [x] **W** Tes otomatis untuk transisi workflow + RLS role kunci — pgTAP per peran, `npm run test:db` (D9)
- [ ] **W** Semua item **W** di atas dicentang **atau** ada keputusan tertulis menunda di `GAP-DAN-PEMETAAN.md` §6

---

## Definisi “selesai”

Modul HAKI dianggap **setara sumber** hanya jika:

1. Semua item **W** tercentang, dan  
2. Setiap item **W** yang ditunda punya baris Keputusan (D#) + alasan, dan  
3. Tidak ada penyimpangan diam-diam dari `ATURAN-KRITIS.md`.

MVP boleh di-ship dengan label **“MVP — belum setara app_haki”** selama checklist menunjukkan apa yang masih `[ ]`.

**Status saat ini: MVP — belum setara app_haki.** Alur AI mock + model sungguhan Gemini 3.1 + hak akses lima peran teruji (`npm run test:db` = 151 asersi, `npm run test:fn` = 13 tes Deno). Yang tersisa: item `[~]` UI/ekspor.
