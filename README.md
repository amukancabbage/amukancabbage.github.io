# Sistem Akademik

Aplikasi web untuk mengelola data akademik (dosen, prodi, penelitian), dibuat dengan
**React + TypeScript + Vite**, database **Supabase**, dan di-deploy ke **Vercel**.

## Fitur

- Login dengan 3 level user: **admin**, **dosen**, dan **pemantau** (lihat [Hak Akses](#hak-akses))
- Data penelitian lengkap dengan **ketua** dan **anggota** penelitian

| Menu | Halaman | Tabel |
|---|---|---|
| Penelitian | Data Penelitian | `penelitian` + `penelitian_anggota` (penelitian_id, dosen_id) |
| Pengaturan | Pengguna | `profiles` (id, email, role, dosen_id) |
| Master Data | Dosen | `dosen` (id, nama, nidn, prodi_id) |
| Master Data | Prodi | `prodi` (id, prodi) |
| Penelitian | Data Penelitian | `penelitian` (id, dosen_id, sub_kategori_penelitian_id, judul_penelitian, tahun, publikasi, url_bukti, url_dokumen, keterangan) |
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
| Lihat penelitian | Semua | Yang ia ketuai **atau** ia menjadi anggota | Semua |
| Tambah penelitian | ✅ (bebas memilih ketua) | ✅ (ketua otomatis dirinya) | ❌ |
| Edit / hapus penelitian | Semua | Hanya yang ia ketuai | ❌ |
| Atur anggota penelitian | ✅ | Hanya pada penelitian yang ia ketuai | ❌ |
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
- [`src/pages/PenelitianPage.tsx`](src/pages/PenelitianPage.tsx):
  - Admin memilih ketua sendiri.
  - Untuk dosen, kolom Ketua disembunyikan dan `dosen_id` diisi otomatis lewat `fixedValues`.
  - Tombol Edit/Hapus hanya muncul jika `canEdit` bernilai benar.
  - Pemantau tidak melihat form dan tombol aksi.
  - Anggota dipilih dengan checkbox (field `type: 'multiselect'` + `junction`).

---

## Cara Menambah Halaman Baru

1. Buat tabel di Supabase (SQL Editor), aktifkan RLS dan buat policy-nya. Contoh policy berbasis role ada di `supabase/auth.sql`.
2. Tambahkan tipe datanya di `src/types.ts`.
3. Buat file halaman di `src/pages/`, misalnya `PengabdianPage.tsx`, dengan meniru `src/pages/PenelitianPage.tsx`.
4. Daftarkan di `src/menu.tsx`:
   ```tsx
   { path: '/pengabdian', label: 'Data Pengabdian', element: <PengabdianPage />, roles: semua },
   ```
   Sidebar dan routing akan bertambah otomatis.

## Struktur Folder

```
supabase/
  schema.sql              # tabel prodi & dosen
  penelitian.sql          # tabel kategori, subkategori & penelitian
  auth.sql                # profil/role, anggota penelitian & hak akses (RLS)
src/
  lib/supabase.ts         # koneksi Supabase
  auth.tsx                # sesi login & profil pengguna
  components/
    CrudPage.tsx          # komponen form + tabel CRUD
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
