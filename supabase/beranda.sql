-- Jalankan di Supabase Dashboard > SQL Editor (setelah pengabdian.sql)
-- Rekap jumlah penelitian & pengabdian per prodi untuk halaman Beranda.
--
-- Sebuah kegiatan dihitung untuk suatu prodi jika ketua ATAU salah satu anggota timnya
-- adalah dosen prodi tersebut. Kegiatan dengan tim lintas prodi terhitung di setiap prodi
-- yang terlibat, sedangkan baris total (prodi_id null) menghitung setiap kegiatan sekali.
--
-- Fungsi ini security definer: semua user login (termasuk dosen) melihat angka rekap
-- seluruh kampus, tanpa bisa melihat isi data kegiatan yang bukan miliknya.

create or replace function public.rekap_kegiatan(p_tahun int default null)
returns table (prodi_id bigint, prodi text, penelitian bigint, pengabdian bigint)
language sql stable security definer set search_path = '' as $$
  with tim_penelitian as (
    select k.id as kegiatan_id, k.dosen_id
    from public.penelitian k
    where k.dosen_id is not null and (p_tahun is null or k.tahun = p_tahun)
    union
    select a.penelitian_id, a.dosen_id
    from public.penelitian_anggota a
    join public.penelitian k on k.id = a.penelitian_id
    where p_tahun is null or k.tahun = p_tahun
  ),
  tim_pengabdian as (
    select k.id as kegiatan_id, k.dosen_id
    from public.pengabdian k
    where k.dosen_id is not null and (p_tahun is null or k.tahun = p_tahun)
    union
    select a.pengabdian_id, a.dosen_id
    from public.pengabdian_anggota a
    join public.pengabdian k on k.id = a.pengabdian_id
    where p_tahun is null or k.tahun = p_tahun
  )
  select
    p.id,
    p.prodi,
    (select count(distinct t.kegiatan_id)
       from tim_penelitian t join public.dosen d on d.id = t.dosen_id
      where d.prodi_id = p.id),
    (select count(distinct t.kegiatan_id)
       from tim_pengabdian t join public.dosen d on d.id = t.dosen_id
      where d.prodi_id = p.id)
  from public.prodi p
  union all
  select
    null,
    'Total',
    (select count(*) from public.penelitian k where p_tahun is null or k.tahun = p_tahun),
    (select count(*) from public.pengabdian k where p_tahun is null or k.tahun = p_tahun)
  order by 1 nulls last;
$$;

-- Daftar tahun yang punya data, untuk pilihan filter di Beranda
create or replace function public.tahun_kegiatan()
returns table (tahun int)
language sql stable security definer set search_path = '' as $$
  select tahun::int from public.penelitian
  union
  select tahun::int from public.pengabdian
  order by 1 desc;
$$;

-- Hanya untuk user yang sudah login
revoke execute on function public.rekap_kegiatan(int) from public, anon;
revoke execute on function public.tahun_kegiatan() from public, anon;
grant execute on function public.rekap_kegiatan(int) to authenticated;
grant execute on function public.tahun_kegiatan() to authenticated;
