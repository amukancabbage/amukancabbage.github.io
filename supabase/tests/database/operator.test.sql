-- Peran operator: mengunggah atas nama dosen di unitnya, tanpa mengajukan atau memutuskan.
begin;
\ir _fixtures.psql
select plan(17);

-- ---------- cakupan unit ----------
select tests.login('op_a');
select is(tests.visible(), array['arc', 'sub', 'sub2', 'wip'], 'operator prodi A melihat semua dokumen unitnya');
select is(tests.visible_files(), array['arc', 'sub', 'sub2', 'wip'], 'operator prodi A membaca berkas dalam unitnya');
select throws_like(format('select public.hki_record_meta(%L)', tests.rid('osub')),
  'NOT_FOUND%', 'dokumen unit lain tidak terlihat');

select tests.login('op_b');
select is(tests.visible(), array['osub'], 'operator prodi B hanya melihat dokumen unitnya');

-- ---------- unggah atas nama ----------
select tests.login('op_a');
select throws_like('select public.hki_create_record()', 'ON_BEHALF_REQUIRED%', 'operator wajib memilih dosen pemilik');
select throws_like('select public.hki_create_record(990001, true)', 'OPERATOR_NO_MANUAL%',
  'operator tidak boleh membuat rekaman manual');
select throws_like('select public.hki_create_record(990003)', 'FORBIDDEN%',
  'operator tidak boleh mengunggah untuk dosen di luar unitnya');
select lives_ok('select public.hki_create_record(990001)', 'operator mengunggah atas nama dosen di unitnya');

reset role;
select is((select owner_dosen_id from public.hki_records where created_by = tests.uid('op_a')), 990001::bigint,
  'dokumen tercatat milik dosen, bukan milik operator');
select tests.login('op_a');

-- ---------- ubah, ajukan, putuskan ----------
select lives_ok(format($$select public.hki_update_fields(%L, %s, '{"kegiatan_terkait": "Hibah uji"}')$$, tests.rid('wip'), tests.versi('wip')),
  'operator dapat melengkapi metadata dokumen unitnya');
select throws_like(format('select public.hki_submit(%L, %s, true)', tests.rid('wip'), tests.versi('wip')),
  'FORBIDDEN%', 'hanya dosen pemilik yang mengajukan');
select throws_like(format($$select public.hki_review(%L, %s, 'approve')$$, tests.rid('sub'), tests.versi('sub')),
  'FORBIDDEN%', 'operator tidak dapat memvalidasi');
select throws_like(format('select public.hki_delete_record(%L)', tests.rid('arc')),
  'INVALID_TRANSITION%', 'dokumen terarsip tidak dapat dihapus');
select lives_ok(format('select public.hki_delete_record(%L)', tests.rid('wip')), 'operator dapat menghapus draf unitnya');
select is(tests.visible(), array['arc', 'sub', 'sub2'], 'dokumen terhapus (soft delete) hilang dari daftar');

-- ---------- modul lain & admin ----------
select lives_ok('select count(*) from public.penelitian', 'operator dapat membaca data penelitian (hanya baca)');
select is_empty('select 1 from public.audit_logs', 'operator tidak membaca log audit');

select * from finish();
rollback;
