-- HAKI fase 5-6: penautan pencipta ↔ dosen, alias, dan fungsi layanan AI.
-- Pencocokan nama dihitung di klien/Edge Function (src/haki/personMatch.ts, port PersonMatcher),
-- tetapi status akhir SELALU ditetapkan server: pemilik → dikonfirmasi, lainnya → disarankan,
-- penolakan & link_manual bertahan, satu dosen tidak boleh dua kali pada peran yang sama.

-- ============================================================
-- 1. Ganti daftar orang (internal)
-- ============================================================
create or replace function public.hki_replace_persons_internal(p_record uuid, p_persons jsonb, p_strict boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
  old_rows jsonb;
  item jsonb;
  i int := 0;
  d bigint;
  st text;
  lm boolean;
  nn text;
  v_peran text;
  v_nama text;
  prev record;
  notified timestamptz;
  seen text[] := array[]::text[];
  p record;
begin
  select * into r from public.hki_records where id = p_record;
  if jsonb_typeof(coalesce(p_persons, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_VALUE: Daftar orang harus berupa array';
  end if;
  if jsonb_array_length(coalesce(p_persons, '[]'::jsonb)) > 50 then
    raise exception 'TOO_MANY_PERSONS: Maksimal 50 orang per dokumen';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into old_rows
  from public.hki_persons x where x.record_id = p_record;
  delete from public.hki_persons where record_id = p_record;

  for item in select value from jsonb_array_elements(coalesce(p_persons, '[]'::jsonb)) loop
    v_nama := trim(coalesce(item ->> 'nama', ''));
    if v_nama = '' then
      if p_strict then
        raise exception 'NAME_REQUIRED: Nama orang wajib diisi';
      end if;
      continue;
    end if;
    i := i + 1;
    nn := coalesce(item ->> 'nama_normal', '');
    v_peran := coalesce(nullif(item ->> 'peran', ''), 'pencipta');
    if v_peran not in ('pencipta', 'pemegang', 'kuasa') then
      raise exception 'INVALID_VALUE: Peran orang tidak dikenal';
    end if;
    d := nullif(item ->> 'dosen_id', '')::bigint;
    lm := coalesce((item ->> 'link_manual')::boolean, false);
    st := nullif(item ->> 'status_cocok', '');

    -- tautan manual lama bertahan bila baris baru tidak membawa tautan manual sendiri
    if not lm and nn <> '' then
      select (e ->> 'dosen_id')::bigint as dosen_id, e ->> 'status_cocok' as status_cocok into prev
      from jsonb_array_elements(old_rows) e
      where e ->> 'nama_normal' = nn and (e ->> 'link_manual')::boolean
      limit 1;
      if found then
        d := prev.dosen_id;
        lm := true;
        st := prev.status_cocok;
      end if;
    end if;

    if d is not null and not exists (select 1 from public.dosen where id = d) then
      d := null;
    end if;

    -- "Bukan saya" bertahan
    if d is not null and exists (
      select 1 from public.hki_person_rejections
      where record_id = p_record and nama_normal = nn and dosen_id = d
    ) then
      if p_strict and lm and coalesce((item ->> 'link_manual')::boolean, false) then
        raise exception 'PERSON_REJECTED: Dosen ini sudah menyatakan bukan dirinya untuk nama tersebut';
      end if;
      d := null;
      lm := false;
      st := 'ambigu';
    end if;

    if d is not null and (d::text || ':' || v_peran) = any (seen) then
      if p_strict then
        raise exception 'DUPLICATE_PERSON: Satu dosen tidak boleh tercantum dua kali pada peran yang sama';
      end if;
      d := null;
      lm := false;
      st := 'ambigu';
    end if;

    notified := null;
    if d is null then
      st := case when st in ('ambigu', 'ditolak') then st else 'eksternal' end;
    elsif d = r.owner_dosen_id then
      st := 'dikonfirmasi';
    elsif exists (
      select 1 from jsonb_array_elements(old_rows) e
      where (e ->> 'dosen_id')::bigint = d and e ->> 'status_cocok' = 'dikonfirmasi'
    ) then
      st := 'dikonfirmasi';
    else
      st := 'disarankan';
      select max((e ->> 'notified_at')::timestamptz) into notified
      from jsonb_array_elements(old_rows) e where (e ->> 'dosen_id')::bigint = d;
    end if;
    if d is not null then
      seen := seen || (d::text || ':' || v_peran);
    end if;

    insert into public.hki_persons (record_id, urutan, nama, nama_normal, peran, alamat, kewarganegaraan,
      dosen_id, status_cocok, link_manual, confidence, page, evidence, notified_at)
    values (p_record, i, left(v_nama, 300), nn, v_peran, nullif(trim(item ->> 'alamat'), ''),
      nullif(trim(item ->> 'kewarganegaraan'), ''), d, st, lm,
      nullif(item ->> 'confidence', '')::numeric, nullif(item ->> 'page', '')::int,
      left(nullif(item ->> 'evidence', ''), 500), notified);
  end loop;

  -- notifikasi saran tanpa judul dokumen; tautan ke halaman konfirmasi
  for p in
    select distinct dosen_id from public.hki_persons
    where record_id = p_record and status_cocok = 'disarankan' and notified_at is null
  loop
    perform public.hki_notify_dosen(p.dosen_id, 'person_suggested',
      'Anda mungkin tercantum sebagai pencipta pada dokumen HKI',
      'Buka halaman konfirmasi untuk menjawab Ya atau Bukan saya.', '/haki/konfirmasi', p_record);
  end loop;
  update public.hki_persons set notified_at = now()
  where record_id = p_record and status_cocok = 'disarankan' and notified_at is null;
end;
$$;

-- ============================================================
-- 2. RPC penautan
-- ============================================================
create or replace function public.hki_put_persons(p_record uuid, p_versi integer, p_persons jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
begin
  perform public.hki_require_auth();
  if not public.hki_can_edit(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan atau tidak dapat diubah';
  end if;
  select * into r from public.hki_records where id = p_record for update;
  if r.versi <> p_versi then
    raise exception 'VERSION_CONFLICT: Dokumen sudah diubah; muat ulang';
  end if;
  perform public.hki_replace_persons_internal(p_record, p_persons, true);
  update public.hki_records set versi = versi + 1, updated_at = now(),
    workflow_status = case when workflow_status in ('DRAFT', 'EXTRACTION_FAILED') then 'NEEDS_VERIFICATION'
                           else workflow_status end
  where id = p_record;
  perform public.hki_audit('persons.update', 'hki_record', p_record::text,
    jsonb_build_object('count', jsonb_array_length(coalesce(p_persons, '[]'::jsonb))));
  return r.versi + 1;
end;
$$;

create or replace function public.hki_link_person(p_record uuid, p_versi integer, p_person bigint, p_dosen bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
  pr public.hki_persons;
  st text;
begin
  perform public.hki_require_auth();
  if not public.hki_can_edit(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan atau tidak dapat diubah';
  end if;
  select * into r from public.hki_records where id = p_record for update;
  if r.versi <> p_versi then
    raise exception 'VERSION_CONFLICT: Dokumen sudah diubah; muat ulang';
  end if;
  select * into pr from public.hki_persons where id = p_person and record_id = p_record;
  if pr.id is null then
    raise exception 'NOT_FOUND: Orang tidak ditemukan';
  end if;

  if p_dosen is not null then
    if not exists (select 1 from public.dosen where id = p_dosen) then
      raise exception 'NOT_FOUND: Dosen tidak ditemukan';
    end if;
    if exists (select 1 from public.hki_person_rejections
               where record_id = p_record and nama_normal = pr.nama_normal and dosen_id = p_dosen) then
      raise exception 'PERSON_REJECTED: Dosen ini sudah menyatakan bukan dirinya untuk nama tersebut';
    end if;
    if exists (select 1 from public.hki_persons
               where record_id = p_record and id <> p_person and dosen_id = p_dosen and peran = pr.peran) then
      raise exception 'DUPLICATE_PERSON: Satu dosen tidak boleh tercantum dua kali pada peran yang sama';
    end if;
  end if;

  st := case
    when p_dosen is null then 'eksternal'
    when p_dosen = r.owner_dosen_id then 'dikonfirmasi'
    when p_dosen = pr.dosen_id and pr.status_cocok = 'dikonfirmasi' then 'dikonfirmasi'
    else 'disarankan'
  end;

  update public.hki_persons set dosen_id = p_dosen, status_cocok = st, link_manual = p_dosen is not null,
    notified_at = case when p_dosen is distinct from pr.dosen_id then null else notified_at end
  where id = p_person;

  if st = 'disarankan' and (p_dosen is distinct from pr.dosen_id or pr.notified_at is null) then
    perform public.hki_notify_dosen(p_dosen, 'person_suggested',
      'Anda mungkin tercantum sebagai pencipta pada dokumen HKI',
      'Buka halaman konfirmasi untuk menjawab Ya atau Bukan saya.', '/haki/konfirmasi', p_record);
    update public.hki_persons set notified_at = now() where id = p_person;
  end if;

  update public.hki_records set versi = versi + 1, updated_at = now() where id = p_record;
  perform public.hki_audit('persons.link', 'hki_record', p_record::text,
    jsonb_build_object('person_id', p_person, 'dosen_id', p_dosen));
  return r.versi + 1;
end;
$$;

-- jawaban dosen yang disarankan: Ya → dikonfirmasi (baru boleh lihat dokumen); Bukan saya → penolakan permanen
create or replace function public.hki_claim_person(p_person bigint, p_terima boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pr public.hki_persons;
  r public.hki_records;
  nama_saya text;
begin
  perform public.hki_require_auth();
  select p.* into pr from public.hki_persons p
  join public.hki_records x on x.id = p.record_id and x.deleted_at is null
  where p.id = p_person and p.dosen_id = public.my_dosen_id() and p.status_cocok = 'disarankan';
  if pr.id is null then
    raise exception 'NOT_FOUND: Saran tidak ditemukan';
  end if;
  select * into r from public.hki_records where id = pr.record_id;
  select nama into nama_saya from public.dosen where id = pr.dosen_id;

  if p_terima then
    update public.hki_persons set status_cocok = 'dikonfirmasi' where id = p_person;
  else
    insert into public.hki_person_rejections (record_id, nama_normal, dosen_id)
    values (pr.record_id, pr.nama_normal, pr.dosen_id)
    on conflict (record_id, nama_normal, dosen_id) do nothing;
    update public.hki_persons set status_cocok = 'ditolak', dosen_id = null, link_manual = false where id = p_person;
  end if;

  update public.notifications set dibaca_at = now()
  where user_id = auth.uid() and record_id = pr.record_id and tipe = 'person_suggested' and dibaca_at is null;

  perform public.hki_notify_dosen(r.owner_dosen_id, 'person_claim',
    case when p_terima then 'Pencipta mengonfirmasi keterlibatan' else 'Dosen menyatakan bukan pencipta' end,
    coalesce(nama_saya, '') || case when p_terima then ' mengonfirmasi sebagai ' else ' menolak tautan sebagai ' end
      || pr.peran || ' "' || pr.nama || '"',
    '/haki/dokumen/' || pr.record_id, pr.record_id);
  perform public.hki_audit(case when p_terima then 'persons.confirm' else 'persons.reject' end,
    'hki_record', pr.record_id::text, jsonb_build_object('person_id', p_person));
end;
$$;

-- kartu konfirmasi: hanya judul, pengunggah, nama tertulis (tanpa berkas/alamat/pencipta lain)
create or replace function public.hki_my_suggestions()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.hki_require_auth();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'person_id', p.id, 'nama_tertulis', p.nama, 'peran', p.peran,
      'judul', r.judul, 'jenis', r.jenis, 'pengunggah', d.nama, 'created_at', r.created_at
    ) order by r.created_at desc)
    from public.hki_persons p
    join public.hki_records r on r.id = p.record_id and r.deleted_at is null
    left join public.dosen d on d.id = r.owner_dosen_id
    where p.dosen_id = public.my_dosen_id() and p.status_cocok = 'disarankan'
  ), '[]'::jsonb);
end;
$$;

-- direktori untuk pencocok nama (setara direktori SIA di sumber; D3)
create or replace function public.hki_match_directory()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.hki_require_auth();
  if public.my_role() not in ('dosen', 'operator', 'validator') then
    raise exception 'FORBIDDEN: Tidak berwenang';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id, 'nama', d.nama, 'unit_id', d.unit_id,
      'aliases', coalesce((select jsonb_agg(a.alias) from public.hki_aliases a where a.dosen_id = d.id), '[]'::jsonb)))
    from public.dosen d
  ), '[]'::jsonb);
end;
$$;

-- pencarian dosen untuk tautan manual; NIDN disamarkan
create or replace function public.hki_lecturer_search(p_q text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.hki_require_auth();
  return coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'id', d.id, 'nama', d.nama, 'unit', u.nama,
        'nidn', case when coalesce(d.nidn, '') = '' then null
                     else repeat('•', greatest(length(d.nidn) - 4, 0)) || right(d.nidn, 4) end) as x
      from public.dosen d
      left join public.units u on u.id = d.unit_id
      where length(trim(coalesce(p_q, ''))) >= 2
        and (d.nama ilike '%' || trim(p_q) || '%'
             or exists (select 1 from public.hki_aliases a where a.dosen_id = d.id and a.alias ilike '%' || trim(p_q) || '%'))
      order by d.nama
      limit 20
    ) s
  ), '[]'::jsonb);
end;
$$;

create or replace function public.hki_put_aliases(p_aliases text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  me bigint := public.my_dosen_id();
  a text;
  clean text[] := array[]::text[];
begin
  perform public.hki_require_auth();
  if me is null then
    raise exception 'DOSEN_NOT_LINKED: Akun belum terhubung ke data dosen';
  end if;
  foreach a in array coalesce(p_aliases, array[]::text[]) loop
    a := trim(regexp_replace(a, '\s+', ' ', 'g'));
    if a <> '' and not (lower(a) = any (select lower(x) from unnest(clean) x)) then
      if length(a) > 120 then
        raise exception 'TOO_LONG: Alias maksimal 120 karakter';
      end if;
      clean := clean || a;
    end if;
  end loop;
  if coalesce(array_length(clean, 1), 0) > 20 then
    raise exception 'ALIAS_LIMIT: Maksimal 20 alias';
  end if;
  delete from public.hki_aliases where dosen_id = me;
  insert into public.hki_aliases (dosen_id, alias) select me, x from unnest(clean) x;
  perform public.hki_audit('alias.update', 'dosen', me::text, jsonb_build_object('count', coalesce(array_length(clean, 1), 0)));
end;
$$;

-- ============================================================
-- 3. AI: mulai baca, terapkan hasil, gagal, statistik
-- ============================================================
create or replace function public.hki_start_extraction(p_record uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
  f public.hki_files;
  reread boolean;
  max_reread int := public.hki_num_setting('ai.max_rereads', 3)::int;
begin
  perform public.hki_require_auth();
  if not public.hki_can_edit(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan atau tidak dapat diubah';
  end if;
  select * into r from public.hki_records where id = p_record for update;
  if r.workflow_status not in ('DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED') then
    raise exception 'INVALID_TRANSITION: Pembacaan AI tidak dapat dimulai dari status ini';
  end if;
  if not public.hki_ai_enabled() then
    raise exception 'AI_DISABLED: Pembacaan AI sedang dinonaktifkan admin';
  end if;
  select * into f from public.hki_files where record_id = p_record and jenis = 'utama';
  if f.id is null then
    raise exception 'NO_MAIN_FILE: Unggah berkas utama terlebih dahulu';
  end if;
  -- pembacaan pertama dari DRAFT tidak dihitung sebagai baca ulang
  reread := r.workflow_status <> 'DRAFT';
  if reread and r.reread_count >= max_reread then
    raise exception 'REREAD_LIMIT: Batas baca ulang AI (%) tercapai', max_reread;
  end if;
  update public.hki_records set workflow_status = 'EXTRACTING',
    reread_count = reread_count + case when reread then 1 else 0 end,
    extra = extra - 'extraction_error', versi = versi + 1, updated_at = now()
  where id = p_record;
  perform public.hki_audit('record.extract_start', 'hki_record', p_record::text, jsonb_build_object('reread', reread));
  return jsonb_build_object('file_id', f.id, 'reread', reread);
end;
$$;

-- dipanggil Edge Function (service_role); menimpa isian termasuk yang sudah diubah dosen
create or replace function public.hki_apply_extraction(
  p_record uuid, p_jenis text, p_fields jsonb, p_persons jsonb, p_warnings jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
  k text;
  v jsonb;
  val text;
  spec text[];
  calc record;
  new_extra jsonb;
begin
  select * into r from public.hki_records where id = p_record and deleted_at is null for update;
  if r.id is null or r.workflow_status <> 'EXTRACTING' then
    return 'STALE';
  end if;
  r.jenis := coalesce(nullif(p_jenis, ''), r.jenis);
  spec := public.hki_spec_keys(r.jenis);
  new_extra := r.extra - spec - 'extraction_error';
  new_extra := jsonb_set(new_extra, '{ai_warnings}', coalesce(p_warnings, '[]'::jsonb));

  delete from public.hki_field_values where record_id = p_record;

  for k, v in select key, value from jsonb_each(coalesce(p_fields, '{}'::jsonb)) loop
    if not (k = any (array['judul', 'no_permohonan', 'tgl_permohonan', 'no_sertifikat', 'status_hki'] || spec)) then
      continue;
    end if;
    val := nullif(trim(v ->> 'value'), '');
    insert into public.hki_field_values (record_id, field, nilai_ai, nilai_final, confidence, page, evidence)
    values (p_record, k, val, val, nullif(v ->> 'confidence', '')::numeric,
      nullif(v ->> 'page', '')::int, left(v ->> 'evidence', 500));

    if k in ('tgl_permohonan', 'tanggal_pengumuman', 'tanggal_eksploitasi') then
      val := public.hki_try_date(val)::text;
    elsif k = 'status_hki' and val not in ('permohonan', 'terdaftar', 'ditolak', 'ditarik', 'kedaluwarsa') then
      val := null;
    elsif k = 'jenis_ciptaan' and val is not null and not exists (
      select 1 from public.hki_master_items where kategori = 'jenis_ciptaan' and nilai = val
    ) then
      val := null;
    end if;

    case k
      when 'judul' then r.judul := val;
      when 'no_permohonan' then r.no_permohonan := val;
      when 'tgl_permohonan' then r.tgl_permohonan := val::date;
      when 'no_sertifikat' then r.no_sertifikat := val;
      when 'status_hki' then r.status_hki := val;
      else
        if val is not null then
          new_extra := jsonb_set(new_extra, array[k], to_jsonb(val));
        end if;
    end case;
  end loop;

  select * into calc from public.hki_compute_validity(r.jenis, r.tgl_permohonan, new_extra);
  if calc.auto then
    r.berlaku_mulai := calc.mulai;
    r.berlaku_akhir := calc.akhir;
  end if;

  update public.hki_records set jenis = r.jenis, judul = r.judul, no_permohonan = r.no_permohonan,
    tgl_permohonan = r.tgl_permohonan, no_sertifikat = r.no_sertifikat, status_hki = r.status_hki,
    berlaku_mulai = r.berlaku_mulai, berlaku_akhir = r.berlaku_akhir, extra = new_extra,
    workflow_status = 'NEEDS_VERIFICATION', versi = versi + 1, updated_at = now()
  where id = p_record;

  if p_persons is not null then
    perform public.hki_replace_persons_internal(p_record, p_persons, false);
  end if;

  perform public.hki_notify_dosen(r.owner_dosen_id, 'extraction_done', 'Hasil bacaan AI siap diverifikasi',
    coalesce(r.judul, '(tanpa judul)'), '/haki/dokumen/' || p_record, p_record);
  perform public.hki_audit('record.extracted', 'hki_record', p_record::text);
  return 'OK';
end;
$$;

create or replace function public.hki_extraction_failed(p_record uuid, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
begin
  update public.hki_records set workflow_status = 'EXTRACTION_FAILED',
    extra = extra || jsonb_build_object('extraction_error', p_code), versi = versi + 1, updated_at = now()
  where id = p_record and workflow_status = 'EXTRACTING' and deleted_at is null
  returning * into r;
  if r.id is null then
    return;
  end if;
  perform public.hki_notify_dosen(r.owner_dosen_id, 'extraction_failed', 'AI tidak dapat membaca dokumen',
    'Kode: ' || p_code, '/haki/dokumen/' || p_record, p_record);
  perform public.hki_audit('record.extract_failed', 'hki_record', p_record::text, jsonb_build_object('code', p_code));
end;
$$;

create or replace function public.hki_ai_month_cost()
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(biaya), 0) from public.hki_extraction_jobs
  where created_at >= date_trunc('month', now()) and not mock;
$$;

-- statistik biaya untuk admin tanpa membuka isi dokumen (D5)
create or replace function public.hki_ai_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN: Hanya admin';
  end if;
  return jsonb_build_object(
    'month_cost', public.hki_ai_month_cost(),
    'budget', public.hki_num_setting('ai.monthly_budget_usd', 0),
    'by_model', coalesce((
      select jsonb_agg(jsonb_build_object('model', model, 'tahap', tahap, 'jumlah', n, 'gagal', g,
        'token_in', ti, 'token_out', tout, 'biaya', b))
      from (
        select model, tahap, count(*) n, count(*) filter (where status = 'gagal') g,
          sum(coalesce(token_in, 0)) ti, sum(coalesce(token_out, 0)) tout, sum(biaya) b
        from public.hki_extraction_jobs
        where created_at >= date_trunc('month', now())
        group by model, tahap order by b desc
      ) s), '[]'::jsonb),
    'failures', coalesce((
      select jsonb_agg(jsonb_build_object('kode', kode_error, 'jumlah', n))
      from (
        select kode_error, count(*) n from public.hki_extraction_jobs
        where status = 'gagal' and created_at >= date_trunc('month', now())
        group by kode_error order by n desc
      ) s), '[]'::jsonb)
  );
end;
$$;

-- ============================================================
-- 4. Hak eksekusi
-- ============================================================
revoke execute on function
  public.hki_replace_persons_internal(uuid, jsonb, boolean),
  public.hki_apply_extraction(uuid, text, jsonb, jsonb, jsonb),
  public.hki_extraction_failed(uuid, text),
  public.hki_ai_month_cost()
from public, anon, authenticated;

grant execute on function
  public.hki_apply_extraction(uuid, text, jsonb, jsonb, jsonb),
  public.hki_extraction_failed(uuid, text),
  public.hki_ai_month_cost()
to service_role;
