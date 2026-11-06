# Peran & akses — Arsip HAKI → Sistem Akademik

## 1. Enam peran sumber

| Peran | Asal di sumber | Cakupan | Inti wewenang |
|---|---|---|---|
| `dosen` | SIA | milik + pencipta **dikonfirmasi** | unggah, verifikasi, ajukan, koreksi, portofolio |
| `operator` | SIA/manual (+unit) | unit + turunan | unggah atas nama dosen unit; **tidak** boleh ajukan / buat manual |
| `validator` | manual saja | institusi atau unit | antrean, putuskan, master, dashboard |
| `pimpinan` | SIA/manual (+unit) | unit + turunan | baca: dashboard, arsip, ekspor |
| `auditor` | manual | biasanya institusi | baca + log audit |
| `super_admin` | manual | admin sistem | users/units/AI/audit/master — **tidak otomatis melihat semua dokumen** |

## 2. Visibilitas dokumen (wajib setara)

User melihat dokumen jika **salah satu** benar:

1. `owner_id` = user, atau
2. tercantum di persons dengan `status_cocok = 'dikonfirmasi'` (**bukan** `disarankan`), atau
3. `unit_id` dokumen masuk cakupan peran `validator` / `pimpinan` / `auditor` / `operator` (unit + semua turunan; `unit_id` role null = seluruh institusi)

Dokumen yang tidak boleh dilihat → respons seperti **tidak ada** (404), bukan 403 yang membocorkan keberadaan.

`disarankan` hanya boleh melihat kartu konfirmasi (judul, pengunggah, nama tertulis) — tanpa berkas, alamat, atau daftar pencipta lain.

## 3. Matriks aksi (ringkas)

| Aksi | dosen | operator | validator | pimpinan | auditor | super_admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Login & profil/alias | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Unggah sendiri | ✓ | — | — | — | — | — |
| Unggah atas nama | — | ✓ (unit) | — | — | — | — |
| Buat rekaman manual | ✓ | ✗ | — | — | — | — |
| Edit (status boleh) | pemilik* | unit* | submitted/koreksi | — | — | — |
| Ajukan | pemilik saja | ✗ | — | — | — | — |
| Validasi (approve/revisi/tolak) | — | — | ✓ cakupan | — | — | — |
| Bulk approve | — | — | ✓ | — | — | — |
| Minta koreksi arsip | pemilik/pencipta | — | — | — | — | — |
| Baca ulang AI | pemilik* | unit* | jika boleh edit | — | — | — |
| Hapus (status boleh) | pemilik* | unit* | — | — | — | — |
| Antrean | — | — | ✓ | — | — | — |
| Arsip + ekspor | ✓ cakupan | ✓ | ✓ | ✓ | ✓ | terbatas** |
| Dashboard | — | — | ✓ | ✓ | ✓ | — |
| Portofolio | ✓ | — | — | — | — | — |
| Konfirmasi pencipta | ✓ | — | — | — | — | — |
| Master data | — | — | ✓ | — | — | ✓ |
| Users / units / AI config | — | — | — | — | — | ✓ |
| Audit log | — | — | — | — | ✓ | ✓ |

\* pemilik atau “owner-like” operator unit  
\*\* super_admin hanya dokumen miliknya / yang ia konfirmasi sebagai pencipta, kecuali ada keputusan baru di gap analysis

## 4. Aturan peran berbahaya jika dilanggar

1. Operator **tidak** `submit` dan **tidak** buat rekaman manual.
2. Hanya pemilik yang `submit`.
3. Hanya validator dalam cakupan unit yang memutuskan.
4. Peran SIA hanya dosen/operator/pimpinan; validator/auditor/super_admin tidak pernah dari SIA.
5. Jangan cabut Super Admin terakhir; jangan nonaktifkan diri sendiri.
6. Peran bersumber SIA tidak dicabut dari UI admin.
7. Operator/pimpinan wajib punya unit saat diberi manual.
8. Unit dokumen **difoto saat unggah** — pindah unit dosen tidak memindahkan dokumen lama.

## 5. Pemetaan role (keputusan D2, 2026-11-06)

Enum target v1: `admin` | `dosen` | `validator` | `operator` | `pemantau`  
(D2 + D6, 2026-11-06)

| Role HAKI sumber | Di sistem ini (v1) | Catatan |
|---|---|---|
| `dosen` | `dosen` (+ `dosen_id`) | unggah, verifikasi, ajukan, koreksi, portofolio |
| `operator` | `operator` (**baru**) | unggah atas nama; cakupan unit; **tidak** ajukan/buat manual |
| `validator` | `validator` (**baru**) | antrean, putuskan, master HAKI, dashboard HAKI |
| `super_admin` | `admin` | kelola users/units/AI/master; **tidak** otomatis melihat semua dokumen HKI (kecuali D5 mengubah ini) |
| `pimpinan` | diganti fungsi oleh `pemantau` (baca arsip HAKI, tanpa unit) | tidak ada role `pimpinan` terpisah |
| `auditor` | **tidak di v1** | log audit: akses `admin` saja sampai role auditor ditambahkan |
| — | `pemantau` | HAKI: baca arsip (+ ekspor read-only). Non-HAKI: lihat semua, tanpa edit (perilaku lama) |

Perluas `Role` di `src/types.ts` + RLS + `menu.tsx` sesuai lima role di atas.

## 6. Unit vs Prodi

Sumber: hierarki `units` (universitas → fakultas → prodi).  
Target sekarang: tabel datar `prodi`.

Untuk HAKI, minimal dibutuhkan:

- entitas unit berhierarki **atau**
- `prodi` + `fakultas` + aturan cakupan setara

Jangan mengasumsikan `prodi_id` dosen = cukup untuk seluruh cakupan operator/validator tanpa model turunan.
