# Sistem Akademik

Aplikasi web untuk mengelola data akademik (dosen, prodi, penelitian), dibuat dengan
**React + TypeScript + Vite**, database **Supabase**, dan di-deploy ke **Vercel**.

## Fitur

- Login dengan 3 level user: **admin**, **dosen**, dan **pemantau** (lihat [Hak Akses](#hak-akses))
- Data penelitian lengkap dengan **ketua** dan **anggota** penelitian

| Menu | Halaman | Tabel |
|---|---|---|
| Utama | Beranda | rekap dari fungsi `rekap_kegiatan()` |
| Penelitian | Data Penelitian | `penelitian` + `penelitian_anggota` (penelitian_id, dosen_id) |
| Pengabdian | Data Pengabdian | `pengabdian` + `pengabdian_anggota` (kolom sama seperti penelitian, dengan `judul_pengabdian`) |
| Pengabdian | Kategori | `kategori_pengabdian` (id, kategori_pengabdian) |
| Pengabdian | Subkategori | `subkategori_pengabdian` (id, sub_kategori_pengabdian, kategori_pengabdian_id) |
| Pengaturan | Pengguna | `profiles` (id, email, role, dosen_id) |
| Master Data | Dosen | `dosen` (id, nama, nidn, prodi_id) |
| Master Data | Prodi | `prodi` (id, prodi) |
| Penelitian | Data Penelitian | `penelitian` (id, dosen_id, ketua_luar, sub_kategori_penelitian_id, judul_penelitian, tahun, publikasi, url_bukti, url_dokumen, keterangan) |
| Penelitian | Kategori | `kategori_penelitian` (id, kategori_penelitian) |
| Penelitian | Subkategori | `subkategori_penelitian` (id, sub_kategori_penelitian, kategori_penelitian_id) |

Relasi antar tabel:

```
prodi ──< dosen ──< penelitian >── subkategori_penelitian >── kategori_penelitian
            │ │         │
            │ └──< penelitian_anggota      (dosen sebagai anggota)
            └── profiles ── auth.users     (akun login)
```

Setiap halaman bisa menambah, menampilkan, mengedit, dan menghapus data (CRUD) sesuai hak akses.
Data yang masih dipakai tabel lain tidak bisa dihapus (misalnya prodi yang masih punya dosen).

## Hak Akses

| | Admin | Dosen | Pemantau |
|---|:-:|:-:|:-:|
| Lihat penelitian | Semua | Yang ia ketuai, ia input, **atau** ia menjadi anggota | Semua |
| Tambah penelitian | ✅ | ✅ (otomatis masuk tim, ketua dipilih dari tim) | ❌ |
| Edit / hapus penelitian dan atur tim | Semua | Yang ia ketuai atau ia input | ❌ |
| Master data (dosen, prodi, kategori, subkategori) | ✅ | ❌ | ❌ |
| Atur pengguna & role | ✅ | ❌ | ❌ |

Hak akses dijaga di **database** lewat Row Level Security (RLS), bukan hanya disembunyikan di
tampilan. Jadi walaupun seseorang memanggil API Supabase langsung, aturannya tetap berlaku.

---

## Tahapan Pengerjaan

### 1. Membuat project React + Vite

```bash
npm create vite@latest sistem-akademik -- --template react-ts
cd sistem-akademik
npm install
```

### 2. Memasang library

```bash
npm install @supabase/supabase-js react-router-dom
```

- `@supabase/supabase-js` untuk koneksi ke database Supabase.
- `react-router-dom` untuk perpindahan halaman (routing).

### 3. Membuat project dan tabel di Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, lalu jalankan file berikut **secara berurutan**:
   1. [`supabase/schema.sql`](supabase/schema.sql): tabel `prodi` dan `dosen`
   2. [`supabase/penelitian.sql`](supabase/penelitian.sql): tabel `kategori_penelitian`, `subkategori_penelitian`, dan `penelitian`
   3. [`supabase/auth.sql`](supabase/auth.sql): tabel `profiles` dan `penelitian_anggota`, serta aturan hak akses (lihat tahap 9)
   4. [`supabase/tim-penelitian.sql`](supabase/tim-penelitian.sql): kolom penginput dan aturan akses untuk tim (lihat tahap 11)
   5. [`supabase/ketua-luar.sql`](supabase/ketua-luar.sql): ketua dari luar daftar dosen (lihat tahap 12)
   6. [`supabase/pengabdian.sql`](supabase/pengabdian.sql): modul pengabdian lengkap (lihat tahap 13)
   7. [`supabase/beranda.sql`](supabase/beranda.sql): fungsi rekap untuk Beranda (lihat tahap 14)

   Urutannya penting karena setiap file merujuk ke tabel dari file sebelumnya.

3. Dua file pertama membuat aturan akses publik untuk uji coba. File `auth.sql` menghapus
   aturan publik tersebut dan menggantinya dengan aturan berdasarkan role.

### 4. Menghubungkan aplikasi ke Supabase

Buat file `.env` di root project (file ini **tidak** ikut di-commit karena sudah ada di `.gitignore`):

```
VITE_SUPABASE_URL=https://<ref-project>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
```

Nilainya diambil dari Supabase → **Project Settings → API Keys** dan **Data API**.

> ⚠️ **Kesalahan yang pernah terjadi:**
> - `Forbidden use of secret API key in browser`: yang dipakai adalah **secret key**.
>   Ganti dengan **publishable key** (`sb_publishable_...`) atau **anon public** key.
>   Secret key tidak boleh dipakai di frontend.
> - `Invalid path specified in request URL`: URL diisi dengan akhiran `/rest/v1/`.
>   Cukup tulis `https://<ref-project>.supabase.co` tanpa path apa pun.

Koneksinya dibuat di [`src/lib/supabase.ts`](src/lib/supabase.ts):

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### 5. Membuat komponen CRUD reusable

Karena semua halaman polanya sama (form + tabel), dibuat satu komponen
[`src/components/CrudPage.tsx`](src/components/CrudPage.tsx). Setiap halaman cukup
mendefinisikan daftar kolomnya. Contoh halaman Dosen:

```tsx
const fields: Field<Dosen>[] = [
  { name: 'nama', label: 'Nama', required: true },
  { name: 'nidn', label: 'NIDN', required: true },
  {
    name: 'prodi_id',
    label: 'Prodi',
    type: 'select',                       // jadi combobox
    required: true,
    source: { table: 'prodi', select: 'id, prodi', order: 'prodi', label: (p) => p.prodi },
    render: (d) => d.prodi?.prodi ?? '-', // yang tampil di tabel: nama prodi, bukan id
  },
];

<CrudPage<Dosen>
  title="Dosen"
  table="dosen"
  select="id, nama, nidn, prodi_id, prodi(prodi)"   // prodi(prodi) = join ke tabel prodi
  fields={fields}
/>
```

Pilihan `type` yang tersedia: `text` (default), `number`, `url`, `textarea`, `select`.
Opsi lain: `wide` (lebar penuh di form) dan `hideInTable` (tidak tampil di tabel).

Tipe data setiap tabel ada di [`src/types.ts`](src/types.ts).

### 6. Membuat layout sidebar

- [`src/components/Layout.tsx`](src/components/Layout.tsx): sidebar di kiri. Di layar HP,
  sidebar disembunyikan dan dibuka dengan tombol ☰.
- [`src/menu.tsx`](src/menu.tsx): daftar menu sidebar sekaligus daftar routing.
- [`src/App.tsx`](src/App.tsx): memakai `HashRouter` (URL berbentuk `/#/dosen`) supaya
  halaman tidak 404 saat di-refresh di Vercel/GitHub Pages.
- [`src/App.css`](src/App.css): tampilan sidebar, form, dan tabel. Tinggi `input` dan
  `select` diset sama (40px) karena combobox bawaan browser lebih pendek dari input.

### 7. Menjalankan di komputer lokal

```bash
npm run dev
```

Buka alamat yang muncul di terminal (biasanya `http://localhost:5173`).

### 8. Deploy ke Vercel

1. Pastikan `.gitignore` berisi:
   ```
   .env
   node_modules
   dist
   .DS_Store
   ```
   `node_modules` **tidak boleh** ikut di-push, karena isinya khusus Mac dan membuat build di Vercel (Linux) gagal.
2. Push project ke GitHub.
3. Di [vercel.com](https://vercel.com) pilih **Add New → Project**, lalu pilih repo-nya.
4. Pengaturan build:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Tambahkan **Environment Variables** `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`
   (nilainya sama dengan `.env`).
6. Klik **Deploy**. Setiap kali environment variable diubah, lakukan **Redeploy**,
   karena nilainya dimasukkan ke kode saat build.

### 9. Sistem login dan 3 level user

**a. Jalankan [`supabase/auth.sql`](supabase/auth.sql)** di SQL Editor. Isinya:

- Tabel `profiles` berisi `role` (`admin` / `dosen` / `pemantau`) dan `dosen_id`, yaitu hubungan
  akun ke data dosen. Profil dibuat **otomatis** oleh trigger setiap ada user baru,
  dengan role awal `pemantau`.
- Tabel `penelitian_anggota` menyimpan anggota penelitian. Ketua tetap disimpan di `penelitian.dosen_id`.
- Fungsi bantu `my_role()`, `my_dosen_id()`, `is_admin()`, `is_ketua()`, dan `is_anggota()` yang dipakai oleh aturan RLS.
- Aturan RLS baru sesuai tabel [Hak Akses](#hak-akses).

**b. Matikan pendaftaran mandiri.** Di Supabase → **Authentication → Sign In / Providers**,
matikan **Allow new users to sign up**. Dengan begitu hanya admin yang bisa membuat akun, dan
orang asing tidak bisa mendaftar sendiri lalu ikut melihat data sebagai pemantau.

**c. Buat akun.** Di Supabase → **Authentication → Users → Add user → Create new user**, isi email dan password,
lalu centang **Auto Confirm User**.

**d. Jadikan akun pertama sebagai admin.** Jalankan di SQL Editor (ganti email-nya):

```sql
update public.profiles set role = 'admin' where email = 'admin@contoh.ac.id';
```

**e. Atur akun lain dari aplikasi.** Login sebagai admin, buka menu **Pengguna**, klik **Edit**, lalu pilih
role-nya. Untuk role **Dosen**, pilih juga **Data Dosen**-nya. Tanpa itu, dosen tidak bisa
menginput penelitian.

**Bagian kode yang terkait:**

- [`src/auth.tsx`](src/auth.tsx): `AuthProvider` menyimpan sesi login dan profil (role & dosen).
  Hook `useAuth()` / `useProfile()` dipakai di halaman.
- [`src/pages/LoginPage.tsx`](src/pages/LoginPage.tsx): form login (`supabase.auth.signInWithPassword`).
- [`src/menu.tsx`](src/menu.tsx): setiap menu punya `roles` yang menentukan siapa yang bisa melihatnya.
  Halaman yang tidak boleh dibuka juga tidak didaftarkan di routing.
- [`src/components/KegiatanPage.tsx`](src/components/KegiatanPage.tsx) (dipakai halaman Penelitian dan Pengabdian):
  - Tombol Edit/Hapus hanya muncul jika `canEdit` bernilai benar.
  - Pemantau tidak melihat form dan tombol aksi.
  - Pemilihan tim dan ketua dijelaskan di tahap 11.

### 10. Import akun dosen dari Excel

Untuk membuat banyak akun dosen sekaligus, gunakan script
[`scripts/import-dosen.mjs`](scripts/import-dosen.mjs). Script ini dijalankan di komputer, bukan di
web, karena membuat akun login membutuhkan **secret key**.

**a. Siapkan file Excel** dengan judul kolom di baris pertama:

| nama | nidn | email | password | prodi |
|---|---|---|---|---|
| Dr. Budi Santoso, M.Kom | 0012345678 | budi@kampus.ac.id | | Teknik Informatika |
| Siti Aminah, M.T. | 0098765432 | siti@kampus.ac.id | Rahasia123 | |

- `nama`, `nidn`, dan `email` **wajib** diisi. Urutan kolom bebas.
- `password` opsional. Kalau kosong, password dibuat acak.
- `prodi` opsional. Kalau diisi, tulisannya harus sama persis dengan data di menu Prodi.
- Format kolom NIDN sebagai **Text** supaya angka 0 di depan tidak hilang. Script juga
  otomatis menambahkan 0 di depan jika NIDN kurang dari 10 digit.

**b. Simpan sebagai CSV.** Di Excel pilih **File → Save As → CSV UTF-8 (Comma delimited)**, lalu
simpan ke folder `data/`, misalnya `data/dosen.csv`. Folder `data/` sudah ada di `.gitignore`,
jadi tidak akan ikut ter-commit.

**c. Tambahkan secret key ke `.env`.** Ambil dari Supabase → **Project Settings → API Keys → Secret keys**:

```
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxx
```

Variabel ini sengaja **tidak** diawali `VITE_`, sehingga Vite tidak memasukkannya ke aplikasi web.
Jangan menambahkannya ke Environment Variables Vercel.

**d. Cek dulu tanpa menyimpan apa pun (dry run):**

```bash
npm run import:dosen -- data/dosen.csv --dry-run
```

Perbaiki baris yang ditandai `✖` di file Excel, lalu simpan ulang sebagai CSV.

**e. Jalankan sungguhan:**

```bash
npm run import:dosen -- data/dosen.csv
```

Untuk setiap baris, script akan:
1. Memakai data dosen dengan NIDN yang sama, atau membuatnya jika belum ada.
2. Membuat akun login. Jika email sudah terdaftar, akunnya dipakai dan password-nya tidak diubah.
3. Mengatur role akun menjadi **dosen** dan menghubungkannya ke data dosen tersebut.

Script aman dijalankan ulang: data yang sudah ada tidak akan dibuat dua kali.

**f. Bagikan password.** Hasilnya disimpan di `data/hasil-import.csv`, termasuk password akun
baru. Bagikan ke masing-masing dosen dengan aman, lalu **hapus file tersebut**.

### 11. Tim peneliti: ketua dipilih dari anggota tim

Dosen yang menginput tidak harus menjadi ketua. Alurnya:

1. Centang **Tim Peneliti**. Dosen yang menginput otomatis tercentang dan tidak bisa dihapus dari tim.
   Kolom pencarian membantu mencari nama di antara banyak dosen.
2. Pilih **Ketua**. Pilihannya hanya berisi dosen yang dicentang di Tim Peneliti.
3. Saat disimpan, ketua masuk ke `penelitian.dosen_id`, dan anggota tim lainnya masuk ke `penelitian_anggota`.

Jalankan [`supabase/tim-penelitian.sql`](supabase/tim-penelitian.sql) di SQL Editor. File ini:

- Menambah kolom `penelitian.created_by`, yang otomatis diisi akun yang menginput.
- Mengubah aturan akses: penelitian boleh diubah/dihapus oleh admin, ketua, **atau** penginput.
  Jadi dosen tetap bisa mengelola penelitian yang ia input walaupun ketuanya orang lain.

Pengecekan "ketua harus anggota tim" dan "penginput harus masuk tim" dilakukan di form
(`validate` dan `lockedValues` di `KegiatanPage.tsx`).

### 12. Ketua dari luar daftar dosen

Jika ketuanya tidak ada di daftar dosen (misalnya dosen dari kampus lain), dan dosen yang menginput
hanya menjadi anggota:

1. Centang **Tim Peneliti**. Isinya cukup anggota yang ada di daftar dosen, termasuk penginput.
2. Di **Ketua**, pilih **"Ketua dari luar daftar dosen…"** di bagian paling bawah.
3. Isi **Nama Ketua (luar daftar dosen)** yang kemudian muncul.

Di tabel, ketua tersebut tampil dengan tanda **(luar)**. Semua dosen yang dicentang tersimpan
sebagai anggota. Penelitian ini tetap bisa diedit oleh dosen yang menginputnya.

Jalankan [`supabase/ketua-luar.sql`](supabase/ketua-luar.sql) di SQL Editor. File ini:

- Membuat `penelitian.dosen_id` boleh kosong.
- Menambah kolom `penelitian.ketua_luar`.
- Menambah aturan bahwa setiap penelitian harus punya tepat **satu** ketua: `dosen_id` **atau** `ketua_luar`.

### 13. Modul Pengabdian

Pengabdian dibuat sama persis dengan penelitian:

- Ada kategori dan subkategori.
- Ada Tim Pengabdian, dan ketua dipilih dari tim atau dari luar daftar dosen.
- Hak akses per role dan pencatatan penginput juga sama.

Jalankan [`supabase/pengabdian.sql`](supabase/pengabdian.sql) di SQL Editor. File ini sudah
lengkap: tabel, fungsi bantu, dan aturan akses. Setelah itu isi kategori dan subkategorinya
lewat menu **Pengabdian → Kategori / Subkategori** (login sebagai admin).

Kedua halaman memakai satu komponen yang sama,
[`src/components/KegiatanPage.tsx`](src/components/KegiatanPage.tsx). Nama kolom diturunkan dari
nama tabel, contohnya untuk `table="pengabdian"`:

| Kegunaan | Nama |
|---|---|
| Judul | `pengabdian.judul_pengabdian` |
| Subkategori | `pengabdian.sub_kategori_pengabdian_id` → `subkategori_pengabdian.sub_kategori_pengabdian` |
| Kategori | `subkategori_pengabdian.kategori_pengabdian_id` → `kategori_pengabdian.kategori_pengabdian` |
| Anggota tim | `pengabdian_anggota (pengabdian_id, dosen_id)` |

Jadi kegiatan baru dengan pola yang sama (misalnya **publikasi** atau **HKI**) cukup dibuat dengan:

1. Salin `supabase/pengabdian.sql`, lalu ganti semua kata `pengabdian` dengan nama baru. Jalankan di SQL Editor.
2. Buat halaman satu baris:
   ```tsx
   <KegiatanPage title="HKI" table="hki" timLabel="Tim Inventor" />
   ```
3. Daftarkan halaman data, kategori, dan subkategorinya di `src/menu.tsx`.

### 14. Beranda: rekap per program studi

Beranda adalah halaman pertama setelah login, untuk semua role. Isinya:

- **Total** penelitian dan pengabdian.
- Jumlah penelitian dan pengabdian **per program studi** (Teknik Informatika, Sistem Informasi, dan prodi lain yang ada di tabel `prodi`).
- Filter **tahun**.

Jalankan [`supabase/beranda.sql`](supabase/beranda.sql) di SQL Editor. File ini membuat dua fungsi:

- `rekap_kegiatan(p_tahun)`: jumlah per prodi ditambah satu baris total.
- `tahun_kegiatan()`: daftar tahun yang punya data, untuk pilihan filter.

**Aturan penghitungan:**

- Sebuah kegiatan dihitung untuk suatu prodi jika **ketua atau salah satu anggota timnya** adalah dosen
  prodi tersebut.
- Kegiatan dengan tim lintas prodi terhitung di setiap prodi yang terlibat. Karena itu, jumlah TI + SI
  bisa lebih besar dari total, sedangkan total menghitung setiap kegiatan satu kali.
- Ketua dari luar daftar dosen tidak punya prodi, jadi kegiatannya dihitung lewat prodi anggotanya.

Kedua fungsi bersifat `security definer`. Dengan begitu, semua user yang login, termasuk dosen, melihat
angka rekap seluruh kampus, tetapi tetap tidak bisa melihat isi kegiatan yang bukan miliknya.

Halamannya ada di [`src/pages/BerandaPage.tsx`](src/pages/BerandaPage.tsx). Data diambil dengan
`supabase.rpc('rekap_kegiatan', { p_tahun })`.

### 15. Data hibah dan import dari Excel

Penelitian dan pengabdian punya kolom tambahan untuk data hibah (mis. hibah internal APBU):

| Kolom | Isi |
| --- | --- |
| `skema` | skema hibah, mis. "Penelitian Dosen Pemula APBU UNISKA T.A 2024/2025" |
| `biaya` | dana hibah dalam rupiah (angka saja) |
| `anggota_luar` | anggota yang tidak ada di daftar dosen, dipisah `;` |
| `anggota_mahasiswa` | NIM anggota mahasiswa, dipisah `;` |

Subkategori (jenis luaran) sekarang opsional, karena data hibah belum tentu punya luaran.

1. Jalankan [`supabase/hibah.sql`](supabase/hibah.sql) di SQL Editor.
2. Simpan sheet Excel sebagai CSV di folder `data/`, misalnya `data/kegiatan.csv`. Kolom yang dibaca:
   `Jenis` (Penelitian/Pengabdian), `Tahun`, `Judul`, `Ketua`, serta opsional `Skema`, `Biaya`,
   `Anggota`, dan `Anggota Mahasiswa`. Kolom lain, misalnya `Prodi` dan `Peran Dosen FTI`, diabaikan.
   Format dosen: `NAMA (NIDN)`, beberapa orang dipisah `;`.
3. Cek dulu, lalu jalankan:
   ```bash
   npm run import:kegiatan -- data/kegiatan.csv --dry-run
   npm run import:kegiatan -- data/kegiatan.csv
   ```

Dosen dicocokkan lewat **NIDN**, jadi perbedaan penulisan nama tidak masalah. Ketua yang tidak ada di
daftar dosen disimpan sebagai ketua luar, dan anggota yang tidak ada disimpan di `anggota_luar`.
Baris dengan jenis, tahun, dan judul yang sudah ada dilewati, sehingga script aman dijalankan ulang.
Rincian per baris disimpan di `data/hasil-import-kegiatan.csv`.

### 16. Artikel mahasiswa

Menu **Mahasiswa › Artikel Mahasiswa** untuk mencatat artikel karya mahasiswa:

- Judul artikel, NPM (boleh kosong), dan nama mahasiswa penulis.
- Jenis artikel: Conference Nasional/Internasional dan Jurnal Nasional/Internasional. Daftar pilihannya ada
  di `jenisArtikel` pada [`src/pages/ArtikelMahasiswaPage.tsx`](src/pages/ArtikelMahasiswaPage.tsx).
- Tahun dan publisher.
- URL bukti dan URL dokumen.
- Anggota mahasiswa (NPM dan nama, bisa banyak), disimpan sebagai array JSON di kolom `anggota_mahasiswa`.
- Anggota dosen (bisa banyak), disimpan di tabel `artikel_mahasiswa_dosen`.

Jalankan [`supabase/artikel-mahasiswa.sql`](supabase/artikel-mahasiswa.sql) di SQL Editor.

Hak akses: admin mengelola semua artikel. Dosen menambah artikel dan otomatis tercatat sebagai anggota
dosen, lalu bisa melihat dan mengubah artikel yang ia input atau yang mencantumkan namanya. Pemantau hanya
melihat.

Isian "bisa banyak" dengan beberapa kolom per baris memakai tipe field `rows` di `CrudPage`:

```tsx
{ name: 'anggota_mahasiswa', label: 'Anggota Mahasiswa', type: 'rows',
  rowFields: [{ name: 'npm', label: 'NPM' }, { name: 'nama', label: 'Nama', required: true }] }
```

---

## Cara Menambah Halaman Baru

1. Buat tabel di Supabase (SQL Editor), aktifkan RLS dan buat policy-nya. Contoh policy berbasis role ada di `supabase/auth.sql`.
2. Tambahkan tipe datanya di `src/types.ts`.
3. Buat file halaman di `src/pages/`, misalnya `LaporanPage.tsx`, dengan meniru `src/pages/DosenPage.tsx` (form biasa) atau `src/pages/PengabdianPage.tsx` (kegiatan dengan tim).
4. Daftarkan di `src/menu.tsx`:
   ```tsx
   { path: '/laporan', label: 'Laporan', element: <LaporanPage />, roles: semua },
   ```
   Sidebar dan routing akan bertambah otomatis.

## Struktur Folder

```
supabase/
  schema.sql              # tabel prodi & dosen
  penelitian.sql          # tabel kategori, subkategori & penelitian
  auth.sql                # profil/role, anggota penelitian & hak akses (RLS)
  tim-penelitian.sql      # penginput penelitian & ketua dipilih dari tim
  ketua-luar.sql          # ketua dari luar daftar dosen
  pengabdian.sql          # modul pengabdian (tabel + hak akses)
  beranda.sql             # fungsi rekap per prodi untuk Beranda
  hibah.sql               # kolom skema, biaya, anggota luar & mahasiswa
  artikel-mahasiswa.sql   # tabel artikel mahasiswa & hak akses
scripts/
  csv.mjs                 # fungsi bersama pembaca CSV
  import-dosen.mjs        # import akun dosen dari CSV (dijalankan di komputer)
  import-kegiatan.mjs     # import data hibah penelitian & pengabdian dari CSV
data/                     # file CSV untuk import (tidak di-commit)
src/
  lib/supabase.ts         # koneksi Supabase
  auth.tsx                # sesi login & profil pengguna
  components/
    CrudPage.tsx          # komponen form + tabel CRUD
    KegiatanPage.tsx      # halaman penelitian/pengabdian (tim, ketua, subkategori)
    Layout.tsx            # sidebar
  pages/                  # satu file per halaman
  menu.tsx                # daftar menu & routing
  types.ts                # tipe data tabel
  App.tsx                 # router
  App.css                 # tampilan
```

## Catatan Keamanan

- Setelah `auth.sql` dijalankan, data hanya bisa diakses oleh pengguna yang sudah login, sesuai role-nya.
- Pastikan **Allow new users to sign up** dimatikan (tahap 9b).
- Jangan pernah memakai **secret key** di frontend. Gunakan publishable/anon key saja.
  Secret key hanya untuk script import di komputer, disimpan di `.env` sebagai `SUPABASE_SECRET_KEY`.
