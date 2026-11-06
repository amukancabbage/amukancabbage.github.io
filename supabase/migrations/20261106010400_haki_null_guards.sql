-- Perbaikan logika NULL: akun tanpa dosen_id (pemantau, admin, validator, operator) membuat
-- `owner_dosen_id = my_dosen_id()` bernilai NULL, sehingga `if not (...)` tidak pernah raise.
-- Ditemukan oleh supabase/tests/database/pemantau.test.sql (pemantau bisa meminta koreksi).

create or replace function public.hki_is_owner(p_owner bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_owner = public.my_dosen_id(), false);
$$;

create or replace function public.hki_owner_like(p_owner bigint, p_unit bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.hki_is_owner(p_owner)
    or coalesce(public.my_role() = 'operator' and public.my_unit_id() is not null
        and public.unit_in_scope(p_unit, public.my_unit_id()), false);
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
  if not (public.hki_is_owner(r.owner_dosen_id) or public.hki_is_confirmed_person(p_record)) then
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

create or replace function public.hki_record_meta(p_record uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.hki_records;
  owner_like boolean;
  is_owner boolean;
  can_edit boolean;
  max_reread int := public.hki_num_setting('ai.max_rereads', 3)::int;
begin
  perform public.hki_require_auth();
  if not public.hki_can_view(p_record) then
    raise exception 'NOT_FOUND: Dokumen tidak ditemukan';
  end if;
  select * into r from public.hki_records where id = p_record;
  owner_like := public.hki_owner_like(r.owner_dosen_id, r.unit_id);
  is_owner := public.hki_is_owner(r.owner_dosen_id);
  can_edit := public.hki_can_edit(p_record);
  return jsonb_build_object(
    'caps', jsonb_build_object(
      'edit', can_edit,
      'upload', can_edit,
      'submit', is_owner
        and r.workflow_status in ('NEEDS_VERIFICATION', 'NEEDS_REVISION', 'CORRECTION_REQUESTED'),
      'review', public.hki_validator_for(r.unit_id) and r.workflow_status = 'SUBMITTED',
      'correction', r.workflow_status = 'ARCHIVED'
        and (is_owner or public.hki_is_confirmed_person(p_record)),
      'delete', owner_like
        and r.workflow_status in ('DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED', 'REJECTED'),
      'extract', can_edit and public.hki_ai_enabled()
        and r.workflow_status in ('DRAFT', 'NEEDS_VERIFICATION', 'NEEDS_REVISION', 'EXTRACTION_FAILED')
        and (r.workflow_status = 'DRAFT' or r.reread_count < max_reread),
      'edit_persons', can_edit
    ),
    'is_owner', is_owner,
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

revoke execute on function public.hki_is_owner(bigint) from public, anon;
