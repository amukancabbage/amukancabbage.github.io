-- Jalankan di Supabase Dashboard > SQL Editor (setelah pengabdian.sql)
-- Kolom tambahan untuk data hibah penelitian & pengabdian (mis. hibah internal APBU):
--   skema             : skema hibah, mis. "Penelitian Dosen Pemula APBU UNISKA T.A 2024/2025"
--   biaya             : dana hibah dalam rupiah
--   anggota_luar      : anggota tim yang tidak ada di daftar dosen, dipisah titik koma
--   anggota_mahasiswa : NIM anggota mahasiswa, dipisah titik koma
-- Subkategori (jenis luaran) menjadi opsional karena data hibah belum tentu punya luaran.

alter table public.penelitian
  add column if not exists skema text,
  add column if not exists biaya bigint check (biaya >= 0),
  add column if not exists anggota_luar text,
  add column if not exists anggota_mahasiswa text,
  alter column sub_kategori_penelitian_id drop not null;

alter table public.pengabdian
  add column if not exists skema text,
  add column if not exists biaya bigint check (biaya >= 0),
  add column if not exists anggota_luar text,
  add column if not exists anggota_mahasiswa text,
  alter column sub_kategori_pengabdian_id drop not null;
