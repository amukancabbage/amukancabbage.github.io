-- Jalankan di Supabase Dashboard > SQL Editor (setelah schema.sql dan penelitian.sql)
-- Login, 3 level user (admin, dosen, pemantau), anggota penelitian, dan hak akses (RLS)

-- ============================================================
-- 1. Profil pengguna: role dan hubungan ke data dosen
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'pemantau' check (role in ('admin', 'dosen', 'pemantau')),
  dosen_id bigint unique references public.dosen (id) on delete set null
);

-- Profil dibuat otomatis setiap ada user baru di Authentication
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Buat profil untuk user yang sudah ada sebelum script ini dijalankan
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ============================================================
-- 2. Anggota penelitian (relasi banyak-ke-banyak penelitian <-> dosen)
-- ============================================================
create table if not exists public.penelitian_anggota (
  penelitian_id bigint not null references public.penelitian (id) on delete cascade,
  dosen_id bigint not null references public.dosen (id) on delete restrict,
  primary key (penelitian_id, dosen_id)
);

create index if not exists penelitian_anggota_dosen_idx on public.penelitian_anggota (dosen_id);

-- ============================================================
-- 3. Fungsi bantu untuk aturan akses
--    security definer = membaca tabel tanpa terkena RLS (mencegah rekursi)
-- ============================================================
create or replace function public.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_dosen_id()
returns bigint language sql stable security definer set search_path = '' as $$
  select dosen_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

create or replace function public.is_anggota(pid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.penelitian_anggota
    where penelitian_id = pid and dosen_id = public.my_dosen_id()
  );
$$;

create or replace function public.is_ketua(pid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.penelitian
    where id = pid and dosen_id = public.my_dosen_id()
  );
$$;

create or replace function public.can_view_penelitian(pid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() in ('admin', 'pemantau'), false)
    or public.is_ketua(pid)
    or public.is_anggota(pid);
$$;

-- ============================================================
-- 4. Hapus aturan akses publik yang lama
-- ============================================================
drop policy if exists "akses publik prodi" on public.prodi;
drop policy if exists "akses publik dosen" on public.dosen;
drop policy if exists "akses publik kategori_penelitian" on public.kategori_penelitian;
drop policy if exists "akses publik subkategori_penelitian" on public.subkategori_penelitian;
drop policy if exists "akses publik penelitian" on public.penelitian;

-- ============================================================
-- 5. Master data: semua user login bisa membaca, hanya admin yang mengubah
-- ============================================================
create policy "baca prodi" on public.prodi
  for select to authenticated using (true);
create policy "admin kelola prodi" on public.prodi
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "baca dosen" on public.dosen
  for select to authenticated using (true);
create policy "admin kelola dosen" on public.dosen
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "baca kategori_penelitian" on public.kategori_penelitian
  for select to authenticated using (true);
create policy "admin kelola kategori_penelitian" on public.kategori_penelitian
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "baca subkategori_penelitian" on public.subkategori_penelitian
  for select to authenticated using (true);
create policy "admin kelola subkategori_penelitian" on public.subkategori_penelitian
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 6. Penelitian
--    admin & pemantau: lihat semua
--    dosen: lihat penelitian sebagai ketua (dosen_id) atau anggota
--    tambah/ubah/hapus: admin, atau dosen untuk penelitian miliknya sendiri
-- ============================================================
create policy "lihat penelitian" on public.penelitian
  for select to authenticated using (
    coalesce(public.my_role() in ('admin', 'pemantau'), false)
    or dosen_id = public.my_dosen_id()
    or public.is_anggota(id)
  );

create policy "tambah penelitian" on public.penelitian
  for insert to authenticated
  with check (public.is_admin() or dosen_id = public.my_dosen_id());

create policy "ubah penelitian" on public.penelitian
  for update to authenticated
  using (public.is_admin() or dosen_id = public.my_dosen_id())
  with check (public.is_admin() or dosen_id = public.my_dosen_id());

create policy "hapus penelitian" on public.penelitian
  for delete to authenticated
  using (public.is_admin() or dosen_id = public.my_dosen_id());

alter table public.penelitian_anggota enable row level security;

create policy "lihat anggota" on public.penelitian_anggota
  for select to authenticated using (public.can_view_penelitian(penelitian_id));

create policy "kelola anggota" on public.penelitian_anggota
  for all to authenticated
  using (public.is_admin() or public.is_ketua(penelitian_id))
  with check (public.is_admin() or public.is_ketua(penelitian_id));

-- ============================================================
-- 7. Profil: user melihat profilnya sendiri, admin melihat & mengubah semua
-- ============================================================
alter table public.profiles enable row level security;

create policy "lihat profil" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

create policy "admin ubah profil" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 8. Jadikan akun pertama sebagai admin (ganti email-nya), lalu jalankan:
-- ============================================================
-- update public.profiles set role = 'admin' where email = 'admin@contoh.ac.id';
