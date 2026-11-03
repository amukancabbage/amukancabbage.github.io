-- Jalankan di Supabase Dashboard > SQL Editor (setelah tim-penelitian.sql)
-- Ketua penelitian boleh berasal dari luar daftar dosen (mis. dosen kampus lain).
-- Ketua diisi salah satu: dosen_id (dari daftar dosen) ATAU ketua_luar (nama bebas).

alter table public.penelitian alter column dosen_id drop not null;

alter table public.penelitian add column if not exists ketua_luar text;

alter table public.penelitian drop constraint if exists penelitian_ketua_check;
alter table public.penelitian
  add constraint penelitian_ketua_check check (num_nonnulls(dosen_id, ketua_luar) = 1);
