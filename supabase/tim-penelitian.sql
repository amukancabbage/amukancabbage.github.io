-- Jalankan di Supabase Dashboard > SQL Editor (setelah auth.sql)
-- Dosen penginput boleh memilih ketua dari tim penelitian, tidak harus dirinya sendiri.
-- Karena itu dicatat siapa yang menginput (created_by), agar penginput tetap bisa mengelola datanya.

-- ============================================================
-- 1. Kolom penginput (otomatis diisi akun yang sedang login)
-- ============================================================
alter table public.penelitian
  add column if not exists created_by uuid default auth.uid()
    references auth.users (id) on delete set null;

create or replace function public.is_pembuat(pid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.penelitian
    where id = pid and created_by = auth.uid()
  );
$$;

create or replace function public.can_view_penelitian(pid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() in ('admin', 'pemantau'), false)
    or public.is_ketua(pid)
    or public.is_anggota(pid)
    or public.is_pembuat(pid);
$$;

-- ============================================================
-- 2. Aturan akses penelitian
--    tambah  : admin, atau dosen (tercatat sebagai penginput)
--    ubah/hapus: admin, ketua, atau penginput
-- ============================================================
drop policy if exists "lihat penelitian" on public.penelitian;
drop policy if exists "tambah penelitian" on public.penelitian;
drop policy if exists "ubah penelitian" on public.penelitian;
drop policy if exists "hapus penelitian" on public.penelitian;

create policy "lihat penelitian" on public.penelitian
  for select to authenticated using (
    coalesce(public.my_role() in ('admin', 'pemantau'), false)
    or dosen_id = public.my_dosen_id()
    or created_by = auth.uid()
    or public.is_anggota(id)
  );

create policy "tambah penelitian" on public.penelitian
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.my_role() = 'dosen' and created_by = auth.uid())
  );

create policy "ubah penelitian" on public.penelitian
  for update to authenticated
  using (public.is_admin() or dosen_id = public.my_dosen_id() or created_by = auth.uid())
  with check (public.is_admin() or dosen_id = public.my_dosen_id() or created_by = auth.uid());

create policy "hapus penelitian" on public.penelitian
  for delete to authenticated
  using (public.is_admin() or dosen_id = public.my_dosen_id() or created_by = auth.uid());

-- ============================================================
-- 3. Anggota: dikelola oleh admin, ketua, atau penginput
-- ============================================================
drop policy if exists "kelola anggota" on public.penelitian_anggota;

create policy "kelola anggota" on public.penelitian_anggota
  for all to authenticated
  using (public.is_admin() or public.is_ketua(penelitian_id) or public.is_pembuat(penelitian_id))
  with check (public.is_admin() or public.is_ketua(penelitian_id) or public.is_pembuat(penelitian_id));
