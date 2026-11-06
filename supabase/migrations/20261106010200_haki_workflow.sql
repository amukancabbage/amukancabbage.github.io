-- HAKI fase 3-4: RPC workflow (security definer). Galat dilempar sebagai 'KODE: pesan'
-- supaya frontend bisa memetakan kode. Rekaman yang tidak boleh dilihat → NOT_FOUND (bukan 403).

-- ============================================================
-- 1. Utilitas internal
-- ============================================================
create or replace function public.hki_require_auth()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED: Silakan masuk terlebih dahulu';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.hki_audit(p_aksi text, p_type text, p_id text, p_detail jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor, aksi, target_type, target_id, detail)
  values (auth.uid(), p_aksi, p_type, p_id, p_detail);
$$;

create or replace function public.hki_notify_dosen(
  p_dosen bigint, p_tipe text, p_judul text, p_isi text, p_link text, p_record uuid
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, tipe, judul, isi, link, record_id)
  select id, p_tipe, p_judul, p_isi, p_link, p_record from public.profiles where dosen_id = p_dosen;
$$;

create or replace function public.hki_notify_validators(
  p_unit bigint, p_tipe text, p_judul text, p_isi text, p_link text, p_record uuid
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, tipe, judul, isi, link, record_id)
  select id, p_tipe, p_judul, p_isi, p_link, p_record from public.profiles
  where role = 'validator' and public.unit_in_scope(p_unit, unit_id);
$$;

create or replace function public.hki_num_setting(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((public.hki_setting(p_key) #>> '{}')::numeric, p_default);
$$;

create or replace function public.hki_ai_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((public.hki_setting('ai.enabled') #>> '{}')::boolean, false);
$$;

create or replace function public.hki_try_date(p text)
returns date language plpgsql immutable set search_path = '' as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return p::date;
exception when others then
  return null;
end;
$$;

create or replace function public.hki_norm_no(p text)
returns text language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p, ''), '[\s./-]+', '', 'g'));
$$;

create or replace function public.hki_spec_keys(p_jenis text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_jenis
    when 'hak_cipta' then array['jenis_ciptaan', 'tanggal_pengumuman', 'tempat_pengumuman']
    when 'paten' then array['klasifikasi_ipc', 'data_prioritas']
    when 'paten_sederhana' then array['klasifikasi_ipc', 'data_prioritas']
    when 'merek' then array['kelas_nice', 'uraian_barang_jasa']
    when 'desain_industri' then array['klasifikasi_locarno', 'jumlah_tampilan']
    when 'dtlst' then array['tanggal_eksploitasi']
    when 'rahasia_dagang' then array['objek_pencatatan']
    when 'indikasi_geografis' then array['nama_ig', 'produk_ig']
    when 'pvt' then array['nama_varietas', 'pemulia']
    else array[]::text[]
  end;
$$;

create or replace function public.hki_common_keys()
returns text[] language sql immutable set search_path = '' as $$
  select array['jenis', 'judul', 'no_permohonan', 'tgl_permohonan', 'no_sertifikat', 'status_hki',
               'sumber_dana', 'kegiatan_terkait', 'pdki_url', 'berlaku_mulai', 'berlaku_akhir'];
$$;

-- masa berlaku otomatis (DOMAIN-DATA §7); auto=false berarti validator menetapkan manual
create or replace function public.hki_compute_validity(
  p_jenis text, p_tgl date, p_extra jsonb, out mulai date, out akhir date, out auto boolean
) language plpgsql immutable set search_path = '' as $$
declare
  jc text := replace(lower(coalesce(p_extra ->> 'jenis_ciptaan', '')), ' ', '_');
  tp date := public.hki_try_date(p_extra ->> 'tanggal_pengumuman');
begin
  auto := true;
  if p_jenis = 'paten' then
    mulai := p_tgl;
    akhir := (p_tgl + interval '20 years' - interval '1 day')::date;
  elsif p_jenis in ('paten_sederhana', 'merek', 'desain_industri') then
    mulai := p_tgl;
    akhir := (p_tgl + interval '10 years' - interval '1 day')::date;
  elsif p_jenis = 'hak_cipta' and tp is not null and jc in (
    'program_komputer', 'fotografi', 'sinematografi', 'permainan_video', 'basis_data', 'terjemahan',
    'perwajahan_karya_tulis', 'potret', 'tafsir', 'saduran', 'bunga_rampai') then
    mulai := make_date(extract(year from tp)::int + 1, 1, 1);
    akhir := make_date(extract(year from tp)::int + 50, 12, 31);
  elsif p_jenis = 'rahasia_dagang' then
    mulai := p_tgl;
    akhir := null;
  elsif p_jenis = 'hak_cipta' then
    auto := false;
  else
    mulai := null;
    akhir := null;
  end if;
end;
$$;

-- Indel ratio = 2*LCS/(la+lb)
create or replace function public.hki_ratio(a text, b text)
returns numeric language plpgsql immutable set search_path = '' as $$
declare
  la int := length(coalesce(a, ''));
  lb int := length(coalesce(b, ''));
  prev int[];
  cur int[];
  i int;
  j int;
begin
  if la = 0 and lb = 0 then return 1; end if;
  if la = 0 or lb = 0 then return 0; end if;
  prev := array_fill(0, array[lb + 1]);
  for i in 1..la loop
    cur := array_fill(0, array[lb + 1]);
    for j in 1..lb loop
      if substr(a, i, 1) = substr(b, j, 1) then
        cur[j + 1] := prev[j] + 1;
      else
        cur[j + 1] := greatest(prev[j + 1], cur[j]);
      end if;
    end loop;
    prev := cur;
  end loop;
  return round(2.0 * prev[lb + 1] / (la + lb), 4);
end;
$$;

create or replace function public.hki_norm_title(p text)
returns text language sql immutable set search_path = '' as $$
  select trim(regexp_replace(lower(coalesce(p, '')), '\s+', ' ', 'g'));
$$;

-- ============================================================
-- 2. Kelengkapan, peringatan lunak, duplikat
-- ============================================================
create or replace function public.hki_problems(p_record uuid, p_with_unconfirmed boolean default true)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.hki_records;
  res jsonb := '[]'::jsonb;
  hi numeric := public.hki_num_setting('ai.confidence_high', 0.85);
  f record;
begin
  select * into r from public.hki_records where id = p_record;
  if r.jenis is null then
    res := res || jsonb_build_object('code', 'JENIS', 'field', 'jenis', 'message', 'Jenis HKI wajib diisi');
  end if;
  if coalesce(trim(r.judul), '') = '' then
    res := res || jsonb_build_object('code', 'JUDUL', 'field', 'judul', 'message', 'Judul wajib diisi');
  end if;
  if coalesce(trim(r.no_permohonan), '') = '' and coalesce(trim(r.no_sertifikat), '') = '' then
    res := res || jsonb_build_object('code', 'NOMOR', 'field', 'no_permohonan',
      'message', 'Isi nomor permohonan atau nomor sertifikat');
  end if;
  if not exists (select 1 from public.hki_persons where record_id = p_record and peran = 'pencipta') then
    res := res || jsonb_build_object('code', 'PENCIPTA', 'message', 'Minimal satu pencipta/inventor');
  end if;
  if not exists (select 1 from public.hki_persons where record_id = p_record and peran = 'pemegang') then
    res := res || jsonb_build_object('code', 'PEMEGANG', 'message', 'Minimal satu pemegang hak');
  end if;
  if not exists (select 1 from public.hki_files where record_id = p_record and jenis = 'utama') then
    res := res || jsonb_build_object('code', 'BERKAS_UTAMA', 'message', 'Berkas utama belum diunggah');
  end if;
  if p_with_unconfirmed then
    for f in
      select field from public.hki_field_values
      where record_id = p_record and not dikonfirmasi and not diubah
        and (confidence is null or confidence < hi or nilai_ai is null)
        and field = any (public.hki_common_keys() || public.hki_spec_keys(r.jenis))
      order by field
    loop
      res := res || jsonb_build_object('code', 'UNCONFIRMED', 'field', f.field,
        'message', 'Field perlu dikonfirmasi atau diubah');
    end loop;
  end if;
  return res;
end;
$$;

create or replace function public.hki_warnings(p_record uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.hki_records;
  res jsonb := '[]'::jsonb;
  np text;
  ns text;
  pat_p text;
  pat_s text;
  d date;
  k text;
  w jsonb;
begin
  select * into r from public.hki_records where id = p_record;
  if r.tgl_permohonan > current_date then
    res := res || jsonb_build_object('code', 'DATE_IN_FUTURE', 'field', 'tgl_permohonan',
      'message', 'Tanggal permohonan di masa depan');
  end if;
  foreach k in array array['tanggal_pengumuman', 'tanggal_eksploitasi'] loop
    d := public.hki_try_date(r.extra ->> k);
    if d > current_date then
      res := res || jsonb_build_object('code', 'DATE_IN_FUTURE', 'field', k, 'message', 'Tanggal di masa depan');
    end if;
  end loop;

  np := public.hki_norm_no(r.no_permohonan);
  ns := public.hki_norm_no(r.no_sertifikat);
  pat_p := case r.jenis
    when 'hak_cipta' then '^EC\d{2}\d{4}\d{4,8}$'
    when 'paten' then '^P\d{2}\d{4}\d{4,8}$'
    when 'paten_sederhana' then '^S\d{2}\d{4}\d{4,8}$'
    when 'desain_industri' then '^A\d{2}\d{4}\d{4,8}$'
  end;
  pat_s := case r.jenis
    when 'hak_cipta' then '^\d{6,12}$'
    when 'paten' then '^IDP\d{6,9}$'
    when 'paten_sederhana' then '^IDS\d{6,9}$'
    when 'merek' then '^IDM\d{6,12}$'
    when 'desain_industri' then '^IDD\d{6,9}$'
  end;
  if pat_p is not null and np <> '' and np !~* pat_p then
    res := res || jsonb_build_object('code', 'PATTERN_MISMATCH', 'field', 'no_permohonan',
      'message', 'Format nomor permohonan tidak lazim untuk jenis ini');
  end if;
  if pat_s is not null and ns <> '' and ns !~* pat_s then
    res := res || jsonb_build_object('code', 'PATTERN_MISMATCH', 'field', 'no_sertifikat',
      'message', 'Format nomor sertifikat tidak lazim untuk jenis ini');
  end if;

  if r.jenis in ('hak_cipta', 'paten', 'paten_sederhana', 'merek', 'desain_industri', 'rahasia_dagang')
     and r.berlaku_mulai is null and r.berlaku_akhir is null then
    res := res || jsonb_build_object('code', 'VALIDITY_UNKNOWN', 'field', 'berlaku_mulai',
      'message', 'Masa berlaku tidak dapat dihitung otomatis; validator menetapkan');
  end if;

  for w in select value from jsonb_array_elements(coalesce(r.extra -> 'ai_warnings', '[]'::jsonb)) loop
    res := res || jsonb_build_object('code', 'AI_WARNING', 'message', w #>> '{}');
  end loop;
  return res;
end;
$$;

-- kandidat duplikat (tanpa cek hak lihat)
create or replace function public.hki_duplicate_ids(p_record uuid)
returns table (id uuid, alasan text, skor numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.hki_records;
  t text;
begin
  select * into r from public.hki_records x where x.id = p_record;
  if r.jenis is null then return; end if;
  t := public.hki_norm_title(r.judul);
  return query
    select o.id,
      case
        when public.hki_norm_no(r.no_sertifikat) <> '' and public.hki_norm_no(o.no_sertifikat) = public.hki_norm_no(r.no_sertifikat) then 'no_sertifikat'
        when public.hki_norm_no(r.no_permohonan) <> '' and public.hki_norm_no(o.no_permohonan) = public.hki_norm_no(r.no_permohonan) then 'no_permohonan'
        else 'judul'
      end,
      case
        when public.hki_norm_no(r.no_sertifikat) <> '' and public.hki_norm_no(o.no_sertifikat) = public.hki_norm_no(r.no_sertifikat) then 1.0
        when public.hki_norm_no(r.no_permohonan) <> '' and public.hki_norm_no(o.no_permohonan) = public.hki_norm_no(r.no_permohonan) then 1.0
        else public.hki_ratio(t, public.hki_norm_title(o.judul))
      end
    from public.hki_records o
    where o.id <> r.id and o.deleted_at is null and o.jenis = r.jenis and (
      (public.hki_norm_no(r.no_sertifikat) <> '' and public.hki_norm_no(o.no_sertifikat) = public.hki_norm_no(r.no_sertifikat))
      or (public.hki_norm_no(r.no_permohonan) <> '' and public.hki_norm_no(o.no_permohonan) = public.hki_norm_no(r.no_permohonan))
      or (
        t <> '' and coalesce(o.judul, '') <> ''
        and (r.tgl_permohonan is null or o.tgl_permohonan is null
             or extract(year from r.tgl_permohonan) = extract(year from o.tgl_permohonan))
        -- batas atas rasio dari panjang; lewati perhitungan LCS yang pasti < 0,90
        and 2.0 * least(length(t), length(public.hki_norm_title(o.judul)))
            / (length(t) + length(public.hki_norm_title(o.judul))) >= 0.9
        and public.hki_ratio(t, public.hki_norm_title(o.judul)) >= 0.9
      )
    );
end;
$$;

-- total bisa lebih besar dari items yang boleh dilihat user
create or replace function public.hki_duplicates(p_record uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  res jsonb;
begin
  if not public.hki_can_view(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan';
  end if;
  select jsonb_build_object(
    'total', count(*),
    'items', coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'alasan', d.alasan, 'skor', d.skor, 'judul', o.judul,
        'workflow_status', o.workflow_status, 'no_sertifikat', o.no_sertifikat))
      filter (where public.hki_can_view(d.id)), '[]'::jsonb))
  into res
  from public.hki_duplicate_ids(p_record) d
  join public.hki_records o on o.id = d.id;
  return res;
end;
$$;

-- snapshot tidak menimpa (record, versi) yang sudah ada
create or replace function public.hki_snapshot(p_record uuid, p_alasan text)
returns void language sql security definer set search_path = '' as $$
  insert into public.hki_record_versions (record_id, versi, alasan, snapshot)
  select r.id, r.versi, p_alasan, to_jsonb(r) || jsonb_build_object(
    'persons', coalesce((select jsonb_agg(to_jsonb(p) order by p.urutan) from public.hki_persons p where p.record_id = r.id), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'jenis', f.jenis, 'nama_asli', f.nama_asli, 'sha256', f.sha256))
                       from public.hki_files f where f.record_id = r.id), '[]'::jsonb))
  from public.hki_records r where r.id = p_record
  on conflict (record_id, versi) do nothing;
$$;

-- ============================================================
-- 3. Privasi, rekaman, berkas
-- ============================================================
create or replace function public.hki_accept_privacy()
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  ts timestamptz := now();
begin
  perform public.hki_require_auth();
  update public.profiles set privacy_notice_accepted_at = ts where id = auth.uid();
  perform public.hki_audit('privacy.accept', 'profile', auth.uid()::text);
  return ts;
end;
$$;

-- operator wajib on_behalf (dosen di unitnya) dan tidak boleh buat manual
create or replace function public.hki_create_record(p_on_behalf bigint default null, p_manual boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role text := public.my_role();
  owner bigint;
  unit bigint;
  rid uuid;
begin
  perform public.hki_require_auth();
  if (select privacy_notice_accepted_at from public.profiles where id = auth.uid()) is null then
    raise exception 'PRIVACY_REQUIRED: Setujui pemberitahuan privasi sebelum mengunggah';
  end if;

  if v_role = 'dosen' then
    owner := public.my_dosen_id();
    if owner is null then
      raise exception 'DOSEN_NOT_LINKED: Akun belum terhubung ke data dosen';
    end if;
    if p_on_behalf is not null and p_on_behalf <> owner then
      raise exception 'FORBIDDEN: Dosen hanya mengunggah atas nama sendiri';
    end if;
  elsif v_role = 'operator' then
    if p_manual then
      raise exception 'OPERATOR_NO_MANUAL: Operator tidak boleh membuat rekaman manual';
    end if;
    if p_on_behalf is null then
      raise exception 'ON_BEHALF_REQUIRED: Pilih dosen pemilik dokumen';
    end if;
    owner := p_on_behalf;
    if not exists (
      select 1 from public.dosen d
      where d.id = owner and public.unit_in_scope(d.unit_id, public.my_unit_id())
    ) then
      raise exception 'FORBIDDEN: Dosen tidak berada di unit Anda';
    end if;
  else
    raise exception 'FORBIDDEN: Peran Anda tidak dapat mengunggah dokumen HKI';
  end if;

  select unit_id into unit from public.dosen where id = owner;

  insert into public.hki_records (owner_dosen_id, unit_id, workflow_status)
  values (owner, unit, case when p_manual then 'NEEDS_VERIFICATION' else 'DRAFT' end)
  returning id into rid;

  perform public.hki_audit(case when p_manual then 'record.create_manual' else 'record.upload' end,
    'hki_record', rid::text, jsonb_build_object('owner_dosen_id', owner, 'unit_id', unit));
  return rid;
end;
$$;

create or replace function public.hki_register_file(
  p_record uuid, p_path text, p_nama text, p_mime text, p_ukuran bigint, p_sha256 text,
  p_halaman integer default null, p_prep jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
  fid uuid;
  jf text;
  dup uuid;
  new_status text;
begin
  perform public.hki_require_auth();
  if not public.hki_can_edit(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan atau tidak dapat diubah';
  end if;
  select * into r from public.hki_records where id = p_record;

  if p_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif') then
    raise exception 'FILE_TYPE: Hanya PDF, JPEG, PNG, atau HEIC';
  end if;
  if coalesce(p_ukuran, 0) <= 0 then
    raise exception 'FILE_EMPTY: Berkas kosong';
  end if;
  if p_ukuran > 20971520 then
    raise exception 'FILE_TOO_LARGE: Maksimal 20 MB';
  end if;
  if p_halaman is not null and p_halaman > 30 then
    raise exception 'TOO_MANY_PAGES: PDF maksimal 30 halaman';
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_HASH: SHA-256 tidak valid';
  end if;
  if p_path not like 'records/' || p_record::text || '/%' then
    raise exception 'INVALID_PATH: Lokasi berkas tidak valid';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'haki-files' and name = p_path) then
    raise exception 'FILE_MISSING: Berkas belum terunggah ke penyimpanan';
  end if;
  if (select count(*) from public.hki_files
      where uploaded_by = auth.uid() and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'RATE_LIMITED: Batas 60 berkas per jam tercapai; coba lagi nanti';
  end if;

  jf := case when exists (select 1 from public.hki_files where record_id = p_record and jenis = 'utama')
             then 'lampiran' else 'utama' end;

  insert into public.hki_files (record_id, jenis, storage_path, nama_asli, mime, ukuran, sha256, halaman, prep)
  values (p_record, jf, p_path, left(p_nama, 255), p_mime, p_ukuran, p_sha256, p_halaman, coalesce(p_prep, '{}'::jsonb))
  returning id into fid;

  -- duplikat SHA-256 hanya informasi, tidak memblokir
  select f.record_id into dup from public.hki_files f
  join public.hki_records o on o.id = f.record_id and o.deleted_at is null
  where f.sha256 = p_sha256 and f.record_id <> p_record
  order by f.created_at limit 1;

  new_status := r.workflow_status;
  if jf = 'utama' and r.workflow_status = 'DRAFT' and not public.hki_ai_enabled() then
    new_status := 'NEEDS_VERIFICATION';
  end if;
  update public.hki_records set workflow_status = new_status, versi = versi + 1, updated_at = now()
  where id = p_record;

  perform public.hki_audit('file.upload', 'hki_record', p_record::text,
    jsonb_build_object('file_id', fid, 'jenis', jf, 'sha256', p_sha256));

  return jsonb_build_object(
    'file_id', fid, 'jenis', jf, 'workflow_status', new_status,
    'ai_enabled', public.hki_ai_enabled(),
    'duplicate_file', dup is not null,
    'duplicate_file_of', case when dup is not null and public.hki_can_view(dup) then dup end);
end;
$$;

create or replace function public.hki_delete_file(p_file uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  f public.hki_files;
begin
  perform public.hki_require_auth();
  select * into f from public.hki_files where id = p_file;
  if f.id is null or not public.hki_can_edit(f.record_id) then
    raise exception 'NOT_FOUND: Berkas tidak ditemukan';
  end if;
  if f.jenis = 'utama' then
    raise exception 'MAIN_FILE: Berkas utama tidak dapat dihapus';
  end if;
  delete from public.hki_files where id = p_file;
  update public.hki_records set versi = versi + 1, updated_at = now() where id = f.record_id;
  perform public.hki_audit('file.delete', 'hki_record', f.record_id::text, jsonb_build_object('file_id', f.id));
  return f.storage_path;
end;
$$;

create or replace function public.hki_delete_record(p_record uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
begin
  perform public.hki_require_auth();
  select * into r from public.hki_records where id = p_record and deleted_at is null;
  if r.id is null or not public.hki_can_view(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan';
  end if;
  if not public.hki_owner_like(r.owner_dosen_id, r.unit_id) then
    raise exception 'FORBIDDEN: Hanya pemilik atau operator unit yang dapat menghapus';
  end if;
  if r.workflow_status not in ('DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED', 'REJECTED') then
    raise exception 'INVALID_TRANSITION: Dokumen dengan status ini tidak dapat dihapus';
  end if;
  update public.hki_records set deleted_at = now(), updated_at = now() where id = p_record;
  delete from public.notifications where record_id = p_record;
  perform public.hki_audit('record.delete', 'hki_record', p_record::text);
end;
$$;

-- ============================================================
-- 4. Ubah field (optimistic locking via versi)
-- ============================================================
create or replace function public.hki_update_fields(
  p_record uuid, p_versi integer, p_fields jsonb, p_confirm text[] default array[]::text[]
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
  o_rec public.hki_records;
  k text;
  v jsonb;
  val text;
  old_val text;
  new_jenis text;
  allowed text[];
  calc record;
  changed text[] := array[]::text[];
  sys_keys text[] := array['ai_warnings', 'extraction_error'];
begin
  perform public.hki_require_auth();
  if not public.hki_can_edit(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan atau tidak dapat diubah';
  end if;
  select * into r from public.hki_records where id = p_record for update;
  o_rec := r;
  if r.versi <> p_versi then
    raise exception 'VERSION_CONFLICT: Dokumen sudah diubah orang lain; muat ulang'
      using detail = jsonb_build_object('versi', r.versi)::text;
  end if;

  new_jenis := coalesce(nullif(trim(p_fields ->> 'jenis'), ''), case when p_fields ? 'jenis' then null else r.jenis end);
  if new_jenis is not null and new_jenis not in ('hak_cipta', 'paten', 'paten_sederhana', 'merek', 'desain_industri',
      'dtlst', 'rahasia_dagang', 'indikasi_geografis', 'pvt') then
    raise exception 'INVALID_VALUE: Jenis HKI tidak dikenal';
  end if;
  allowed := public.hki_common_keys() || public.hki_spec_keys(new_jenis);

  for k, v in select key, value from jsonb_each(coalesce(p_fields, '{}'::jsonb)) loop
    if not (k = any (allowed)) then
      raise exception 'UNKNOWN_FIELD: Field % tidak berlaku untuk jenis ini', k;
    end if;
    val := nullif(trim(v #>> '{}'), '');
    if length(val) > 2000 then
      raise exception 'TOO_LONG: Isian % terlalu panjang', k;
    end if;
    if k in ('tgl_permohonan', 'berlaku_mulai', 'berlaku_akhir', 'tanggal_pengumuman', 'tanggal_eksploitasi')
       and val is not null and public.hki_try_date(val) is null then
      raise exception 'INVALID_DATE: Tanggal % harus berformat YYYY-MM-DD', k;
    end if;
    if k = 'status_hki' and val is not null
       and val not in ('permohonan', 'terdaftar', 'ditolak', 'ditarik', 'kedaluwarsa') then
      raise exception 'INVALID_VALUE: Status HKI tidak dikenal';
    end if;
    if k in ('sumber_dana', 'jenis_ciptaan') and val is not null and not exists (
      select 1 from public.hki_master_items where kategori = k and nilai = val and aktif
    ) then
      raise exception 'INVALID_MASTER: Nilai % tidak ada di master aktif', k;
    end if;
    if k = 'pdki_url' and val is not null and val !~* '^https?://' then
      raise exception 'INVALID_URL: Tautan PDKI harus diawali http:// atau https://';
    end if;

    old_val := coalesce(to_jsonb(o_rec) ->> k, o_rec.extra ->> k);
    case k
      when 'jenis' then r.jenis := val;
      when 'judul' then r.judul := val;
      when 'no_permohonan' then r.no_permohonan := val;
      when 'tgl_permohonan' then r.tgl_permohonan := val::date;
      when 'no_sertifikat' then r.no_sertifikat := val;
      when 'status_hki' then r.status_hki := val;
      when 'sumber_dana' then r.sumber_dana := val;
      when 'kegiatan_terkait' then r.kegiatan_terkait := val;
      when 'pdki_url' then r.pdki_url := val;
      when 'berlaku_mulai' then r.berlaku_mulai := val::date;
      when 'berlaku_akhir' then r.berlaku_akhir := val::date;
      else
        r.extra := case when val is null then r.extra - k else jsonb_set(r.extra, array[k], to_jsonb(val)) end;
    end case;

    if old_val is distinct from val then
      changed := changed || k;
      insert into public.hki_field_values (record_id, field, nilai_final, diubah)
      values (p_record, k, val, true)
      on conflict (record_id, field) do update set nilai_final = excluded.nilai_final, diubah = true, updated_at = now();
    end if;
  end loop;

  -- buang isian khusus yang tidak berlaku setelah jenis berganti
  if r.jenis is distinct from o_rec.jenis then
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into r.extra
    from jsonb_each(r.extra)
    where key = any (public.hki_spec_keys(r.jenis) || sys_keys);
  end if;

  select * into calc from public.hki_compute_validity(r.jenis, r.tgl_permohonan, r.extra);
  if calc.auto then
    r.berlaku_mulai := calc.mulai;
    r.berlaku_akhir := calc.akhir;
  end if;

  if coalesce(array_length(p_confirm, 1), 0) > 0 then
    update public.hki_field_values set dikonfirmasi = true, updated_at = now()
    where record_id = p_record and field = any (p_confirm);
  end if;

  update public.hki_records set
    jenis = r.jenis, judul = r.judul, no_permohonan = r.no_permohonan, tgl_permohonan = r.tgl_permohonan,
    no_sertifikat = r.no_sertifikat, status_hki = r.status_hki, sumber_dana = r.sumber_dana,
    kegiatan_terkait = r.kegiatan_terkait, pdki_url = r.pdki_url,
    berlaku_mulai = r.berlaku_mulai, berlaku_akhir = r.berlaku_akhir, extra = r.extra,
    -- isi_manual: edit pertama dari DRAFT/EXTRACTION_FAILED
    workflow_status = case when r.workflow_status in ('DRAFT', 'EXTRACTION_FAILED') then 'NEEDS_VERIFICATION'
                           else r.workflow_status end,
    versi = r.versi + 1,
    updated_at = now()
  where id = p_record;

  perform public.hki_audit('record.update', 'hki_record', p_record::text,
    jsonb_build_object('fields', changed, 'confirmed', p_confirm));
  return r.versi + 1;
end;
$$;

-- ============================================================
-- 5. Ajukan, putuskan, koreksi
-- ============================================================
create or replace function public.hki_submit(p_record uuid, p_versi integer, p_pernyataan boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
  probs jsonb;
  dups integer;
begin
  perform public.hki_require_auth();
  if not public.hki_can_view(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan';
  end if;
  select * into r from public.hki_records where id = p_record for update;
  if r.owner_dosen_id is distinct from public.my_dosen_id() then
    raise exception 'FORBIDDEN: Hanya dosen pemilik yang dapat mengajukan';
  end if;
  if r.workflow_status not in ('NEEDS_VERIFICATION', 'NEEDS_REVISION', 'CORRECTION_REQUESTED') then
    raise exception 'INVALID_TRANSITION: Dokumen tidak dapat diajukan dari status ini';
  end if;
  if r.versi <> p_versi then
    raise exception 'VERSION_CONFLICT: Dokumen sudah diubah; muat ulang';
  end if;
  if not coalesce(p_pernyataan, false) then
    raise exception 'STATEMENT_REQUIRED: Centang pernyataan kebenaran data';
  end if;
  probs := public.hki_problems(p_record, true);
  if jsonb_array_length(probs) > 0 then
    raise exception 'SUBMISSION_INCOMPLETE: Data belum lengkap' using detail = probs::text;
  end if;

  update public.hki_records set workflow_status = 'SUBMITTED', submitted_at = now(),
    versi = versi + 1, updated_at = now()
  where id = p_record;
  perform public.hki_snapshot(p_record, 'ajukan');
  insert into public.hki_review_actions (record_id, aksi) values (p_record, 'ajukan');
  perform public.hki_notify_validators(r.unit_id, 'submitted', 'Dokumen HKI baru menunggu validasi',
    coalesce(r.judul, '(tanpa judul)'), '/haki/dokumen/' || p_record, p_record);
  perform public.hki_audit('record.submit', 'hki_record', p_record::text);

  select count(*) into dups from public.hki_duplicate_ids(p_record);
  return jsonb_build_object('versi', r.versi + 1, 'duplicates_total', dups);
end;
$$;

create or replace function public.hki_approve_internal(p_record uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
begin
  select * into r from public.hki_records where id = p_record;
  if public.hki_norm_no(r.no_sertifikat) <> '' and exists (
    select 1 from public.hki_records o
    where o.id <> r.id and o.deleted_at is null and o.workflow_status = 'ARCHIVED' and o.jenis = r.jenis
      and public.hki_norm_no(o.no_sertifikat) = public.hki_norm_no(r.no_sertifikat)
  ) then
    raise exception 'CERT_DUPLICATE: Nomor sertifikat sudah ada di arsip untuk jenis ini';
  end if;
  update public.hki_records set workflow_status = 'ARCHIVED', locked = true,
    validated_by = auth.uid(), validated_at = now(), versi = versi + 1, updated_at = now()
  where id = p_record;
  perform public.hki_snapshot(p_record, 'approve');
  insert into public.hki_review_actions (record_id, aksi) values (p_record, 'approve');
  perform public.hki_notify_dosen(r.owner_dosen_id, 'review_approved', 'Dokumen HKI disetujui dan diarsipkan',
    coalesce(r.judul, '(tanpa judul)'), '/haki/dokumen/' || p_record, p_record);
  perform public.hki_audit('record.approve', 'hki_record', p_record::text);
end;
$$;

create or replace function public.hki_review(
  p_record uuid, p_versi integer, p_aksi text, p_catatan text default null, p_catatan_field jsonb default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
  probs jsonb;
  cat text := nullif(trim(coalesce(p_catatan, '')), '');
  catf jsonb := nullif(nullif(p_catatan_field, '{}'::jsonb), 'null'::jsonb);
begin
  perform public.hki_require_auth();
  if not public.hki_can_view(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan';
  end if;
  select * into r from public.hki_records where id = p_record for update;
  if not public.hki_validator_for(r.unit_id) then
    raise exception 'FORBIDDEN: Hanya validator dalam cakupan unit yang dapat memutuskan';
  end if;
  if r.workflow_status <> 'SUBMITTED' then
    raise exception 'INVALID_TRANSITION: Hanya dokumen yang menunggu validasi yang dapat diputuskan';
  end if;
  if r.versi <> p_versi then
    raise exception 'VERSION_CONFLICT: Dokumen sudah diubah; muat ulang';
  end if;

  if p_aksi = 'approve' then
    -- validator boleh meloloskan field yang belum dikonfirmasi dosen
    probs := public.hki_problems(p_record, false);
    if jsonb_array_length(probs) > 0 then
      raise exception 'SUBMISSION_INCOMPLETE: Data belum lengkap' using detail = probs::text;
    end if;
    perform public.hki_approve_internal(p_record);
  elsif p_aksi = 'request_revision' then
    if cat is null and catf is null then
      raise exception 'NOTE_REQUIRED: Tulis catatan umum atau catatan per field';
    end if;
    update public.hki_records set workflow_status = 'NEEDS_REVISION', versi = versi + 1, updated_at = now()
    where id = p_record;
    perform public.hki_snapshot(p_record, 'request_revision');
    insert into public.hki_review_actions (record_id, aksi, catatan, catatan_field)
    values (p_record, 'request_revision', cat, catf);
    perform public.hki_notify_dosen(r.owner_dosen_id, 'review_revision', 'Dokumen HKI perlu revisi',
      coalesce(cat, 'Lihat catatan per field'), '/haki/dokumen/' || p_record, p_record);
    perform public.hki_audit('record.request_revision', 'hki_record', p_record::text);
  elsif p_aksi = 'reject' then
    if cat is null then
      raise exception 'NOTE_REQUIRED: Alasan penolakan wajib diisi';
    end if;
    update public.hki_records set workflow_status = 'REJECTED', versi = versi + 1, updated_at = now()
    where id = p_record;
    perform public.hki_snapshot(p_record, 'reject');
    insert into public.hki_review_actions (record_id, aksi, catatan, catatan_field)
    values (p_record, 'reject', cat, catf);
    perform public.hki_notify_dosen(r.owner_dosen_id, 'review_rejected', 'Dokumen HKI ditolak',
      cat, '/haki/dokumen/' || p_record, p_record);
    perform public.hki_audit('record.reject', 'hki_record', p_record::text);
  else
    raise exception 'INVALID_ACTION: Aksi tidak dikenal';
  end if;

  return (select versi from public.hki_records where id = p_record);
end;
$$;

-- alasan tidak layak setujui massal; null = layak (aturan lebih ketat daripada UI)
create or replace function public.hki_bulk_ineligible(p_record uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  r public.hki_records;
  hi numeric := public.hki_num_setting('ai.confidence_high', 0.85);
begin
  select * into r from public.hki_records where id = p_record and deleted_at is null;
  if r.id is null or not public.hki_validator_for(r.unit_id) then return 'NOT_FOUND'; end if;
  if r.workflow_status <> 'SUBMITTED' then return 'STATUS'; end if;
  if not exists (select 1 from public.hki_field_values where record_id = p_record and nilai_ai is not null) then
    return 'NO_AI_DATA';
  end if;
  if exists (select 1 from public.hki_field_values where record_id = p_record and diubah)
     or exists (select 1 from public.hki_persons where record_id = p_record and link_manual) then
    return 'HUMAN_EDITED';
  end if;
  if exists (
    select 1 from public.hki_field_values
    where record_id = p_record and (confidence is null or confidence < hi)
      and field = any (public.hki_common_keys() || public.hki_spec_keys(r.jenis))
  ) then
    return 'LOW_CONFIDENCE';
  end if;
  if jsonb_array_length(public.hki_warnings(p_record)) > 0 then return 'WARNINGS'; end if;
  if jsonb_array_length(public.hki_problems(p_record, false)) > 0 then return 'INCOMPLETE'; end if;
  if exists (select 1 from public.hki_duplicate_ids(p_record)) then return 'DUPLICATE'; end if;
  return null;
end;
$$;

create or replace function public.hki_bulk_approve(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  rid uuid;
  why text;
  ok jsonb := '[]'::jsonb;
  skip jsonb := '[]'::jsonb;
begin
  perform public.hki_require_auth();
  if public.my_role() <> 'validator' then
    raise exception 'FORBIDDEN: Hanya validator';
  end if;
  if coalesce(array_length(p_ids, 1), 0) not between 1 and 100 then
    raise exception 'BULK_LIMIT: Pilih 1 sampai 100 dokumen';
  end if;
  foreach rid in array p_ids loop
    why := public.hki_bulk_ineligible(rid);
    if why is null then
      begin
        perform public.hki_approve_internal(rid);
        ok := ok || to_jsonb(rid);
      exception when others then
        skip := skip || jsonb_build_object('id', rid, 'reason', split_part(sqlerrm, ':', 1));
      end;
    else
      skip := skip || jsonb_build_object('id', rid, 'reason', why);
    end if;
  end loop;
  perform public.hki_audit('record.bulk_approve', 'hki_record', null,
    jsonb_build_object('approved', ok, 'skipped', skip));
  return jsonb_build_object('approved', ok, 'skipped', skip);
end;
$$;

create or replace function public.hki_request_correction(p_record uuid, p_alasan text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.hki_records;
  v_alasan text := trim(coalesce(p_alasan, ''));
begin
  perform public.hki_require_auth();
  if not public.hki_can_view(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan';
  end if;
  select * into r from public.hki_records where id = p_record for update;
  if not (r.owner_dosen_id = public.my_dosen_id() or public.hki_is_confirmed_person(p_record)) then
    raise exception 'FORBIDDEN: Hanya pemilik atau pencipta terkonfirmasi yang dapat meminta koreksi';
  end if;
  if r.workflow_status <> 'ARCHIVED' then
    raise exception 'INVALID_TRANSITION: Koreksi hanya untuk dokumen terarsip';
  end if;
  if length(v_alasan) < 3 then
    raise exception 'REASON_REQUIRED: Alasan koreksi minimal 3 karakter';
  end if;

  perform public.hki_snapshot(p_record, 'arsip sebelum koreksi');
  update public.hki_records set workflow_status = 'CORRECTION_REQUESTED', locked = false,
    versi = versi + 1, updated_at = now()
  where id = p_record;
  insert into public.hki_review_actions (record_id, aksi, catatan) values (p_record, 'minta_koreksi', v_alasan);
  perform public.hki_notify_validators(r.unit_id, 'correction_requested', 'Permintaan koreksi arsip HKI',
    v_alasan, '/haki/dokumen/' || p_record, p_record);
  perform public.hki_audit('record.request_correction', 'hki_record', p_record::text);
  return r.versi + 1;
end;
$$;

-- ============================================================
-- 6. Meta, riwayat, sapu EXTRACTING macet, log
-- ============================================================
create or replace function public.hki_record_meta(p_record uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.hki_records;
  owner_like boolean;
  can_edit boolean;
  max_reread int := public.hki_num_setting('ai.max_rereads', 3)::int;
begin
  perform public.hki_require_auth();
  if not public.hki_can_view(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan';
  end if;
  select * into r from public.hki_records where id = p_record;
  owner_like := public.hki_owner_like(r.owner_dosen_id, r.unit_id);
  can_edit := public.hki_can_edit(p_record);
  return jsonb_build_object(
    'caps', jsonb_build_object(
      'edit', can_edit,
      'upload', can_edit,
      'submit', r.owner_dosen_id = public.my_dosen_id()
        and r.workflow_status in ('NEEDS_VERIFICATION', 'NEEDS_REVISION', 'CORRECTION_REQUESTED'),
      'review', public.hki_validator_for(r.unit_id) and r.workflow_status = 'SUBMITTED',
      'correction', r.workflow_status = 'ARCHIVED'
        and (r.owner_dosen_id = public.my_dosen_id() or public.hki_is_confirmed_person(p_record)),
      'delete', owner_like
        and r.workflow_status in ('DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED', 'REJECTED'),
      'extract', can_edit and public.hki_ai_enabled()
        and r.workflow_status in ('DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED')
        and (r.workflow_status = 'DRAFT' or r.reread_count < max_reread),
      'edit_persons', can_edit
    ),
    'is_owner', r.owner_dosen_id = public.my_dosen_id(),
    'reread_count', r.reread_count,
    'max_rereads', max_reread,
    'problems', public.hki_problems(p_record, true),
    'warnings', public.hki_warnings(p_record),
    'duplicates', public.hki_duplicates(p_record),
    'bulk_ineligible', case when r.workflow_status = 'SUBMITTED' and public.hki_validator_for(r.unit_id)
                            then public.hki_bulk_ineligible(p_record) end
  );
end;
$$;

create or replace function public.hki_history(p_record uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.hki_require_auth();
  if not public.hki_can_view(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan';
  end if;
  return coalesce((
    select jsonb_agg(x order by x.at)
    from (
      select a.created_at as at, 'review' as kind, a.aksi, a.catatan, a.catatan_field as detail,
        coalesce(d.nama, p.email) as actor
      from public.hki_review_actions a
      left join public.profiles p on p.id = a.actor
      left join public.dosen d on d.id = p.dosen_id
      where a.record_id = p_record
      union all
      select l.created_at, 'audit', l.aksi, null, null, coalesce(d.nama, p.email)
      from public.audit_logs l
      left join public.profiles p on p.id = l.actor
      left join public.dosen d on d.id = p.dosen_id
      where l.target_type = 'hki_record' and l.target_id = p_record::text
        and l.aksi in ('record.upload', 'record.create_manual', 'record.extract_start', 'record.extracted',
                       'record.extract_failed', 'file.upload', 'file.delete')
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.hki_sweep_stale()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  mins int := public.hki_num_setting('ai.stale_minutes', 6)::int;
  r record;
  n int := 0;
begin
  for r in
    update public.hki_records
    set workflow_status = 'EXTRACTION_FAILED',
        extra = extra || jsonb_build_object('extraction_error', 'TIMEOUT'),
        updated_at = now()
    where workflow_status = 'EXTRACTING' and deleted_at is null
      and updated_at < now() - make_interval(mins => mins)
    returning id, owner_dosen_id
  loop
    n := n + 1;
    perform public.hki_notify_dosen(r.owner_dosen_id, 'extraction_failed', 'AI tidak dapat membaca dokumen',
      'Kode: TIMEOUT', '/haki/dokumen/' || r.id, r.id);
    perform public.hki_audit('record.extract_failed', 'hki_record', r.id::text, '{"code":"TIMEOUT"}'::jsonb);
  end loop;
  return n;
end;
$$;

create or replace function public.hki_log(p_aksi text, p_record uuid default null, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.hki_require_auth();
  if p_aksi not in ('file.view', 'export.csv', 'export.xlsx', 'export.zip') then
    raise exception 'INVALID_ACTION: Aksi log tidak diizinkan';
  end if;
  if p_record is not null and not public.hki_can_view(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan';
  end if;
  perform public.hki_audit(p_aksi, case when p_record is null then null else 'hki_record' end,
    p_record::text, p_detail);
end;
$$;

-- ============================================================
-- 7. Hak eksekusi: utilitas internal tidak boleh dipanggil klien
-- ============================================================
revoke execute on function
  public.hki_audit(text, text, text, jsonb),
  public.hki_notify_dosen(bigint, text, text, text, text, uuid),
  public.hki_notify_validators(bigint, text, text, text, text, uuid),
  public.hki_snapshot(uuid, text),
  public.hki_approve_internal(uuid),
  public.hki_duplicate_ids(uuid),
  public.hki_problems(uuid, boolean),
  public.hki_warnings(uuid),
  public.hki_bulk_ineligible(uuid)
from public, anon, authenticated;
