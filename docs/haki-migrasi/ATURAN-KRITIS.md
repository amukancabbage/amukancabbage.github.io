# Aturan bisnis kritis (mudah terlewat)

Baca daftar ini sebelum menyederhanakan desain. Setiap item berasal dari perilaku sumber `app_haki`.

1. **Salah orang > tidak cocok.** Nama pendek harus match persis; kandidat seri → `ambigu`, jangan tebak.
2. **`disarankan` ≠ akses dokumen.** Hanya kartu `/confirm`. Notifikasi/email tanpa judul.
3. **`person_rejections` dan `link_manual` bertahan** lewat edit daftar, rematch, dan baca ulang AI.
4. **Unik nomor sertifikat hanya di `ARCHIVED` + belum dihapus**, per jenis.
5. **`super_admin` tidak otomatis melihat semua rekaman.**
6. **Operator tidak boleh ajukan / buat manual.**
7. **`unit_id` dokumen difoto saat unggah.**
8. **Cakupan unit hierarkis** (diri + turunan); role unit null = institusi.
9. **Optimistic locking** (`versi` + If-Match) pada edit field/persons/link; UI konflik per field.
10. **AI background** + sapu `EXTRACTING` stale (~6 menit → TIMEOUT). Baca ulang bypass cache; mock tidak di-cache.
11. **Batas baca ulang** (default 3) menimpa edit dosen — UI harus memperingatkan.
12. **Anggaran AI bulanan** memblokir panggilan baru, bukan cache.
13. **Pernyataan kebenaran** wajib saat ajukan; **privacy notice** wajib sebelum unggah.
14. **Validator boleh approve meski field belum dikonfirmasi dosen**; bulk approve jauh lebih ketat.
15. **Field perlu konfirmasi** jika conf null/<high atau nilai null — kecuali sudah diubah/dikonfirmasi.
16. **Soft delete manual:** setiap query filter `deleted_at IS NULL`.
17. **Tahun = `tgl_permohonan`.**
18. **Audit append-only** (trigger/REVOKE); juga dipakai rate-limit login di sumber.
19. **`record_versions` tidak menimpa** baris (record, versi) yang sudah ada.
20. **Tanggal ISO di storage; `jenis_ciptaan` simpan kode master; NIDN disamarkan di search API.**
21. **Login anti-enumerasi** (pesan sama, timing); password tidak disimpan.
22. **`sso_subject` konsisten** (`sia:<username>`) antara materialize & login pertama.
23. **Tidak ada `tgl_sertifikat`.** Jangan ditambahkan.
24. **Dokumen tak terlihat → 404**, bukan 403 informatif.
25. **Duplikat SHA-256 hanya info**, tidak memblokir unggah; unik sertifikat memblokir arsip.
26. **UI kontrak:** autosave 10 dtk, `?next=` aman, konteks antrean sessionStorage, tautan `/record?id=`, `/confirm`.
27. **HEIC:** tolak di klien jika tidak bisa didekode; jangan andalkan server decode HEIC.
28. **Satu dosen ≠ dua pencipta** pada dokumen yang sama.
29. **Pemilik otomatis `dikonfirmasi`** jika cocok sebagai pencipta; orang lain mulai `disarankan`.
30. **Setelah soft-delete, notifikasi yang menaut rekaman ikut hilang**; nomor sertifikat boleh dipakai lagi.

Jika terpaksa menyimpang: tulis keputusan di `GAP-DAN-PEMETAAN.md` (bagian Keputusan) + alasan + dampak.
