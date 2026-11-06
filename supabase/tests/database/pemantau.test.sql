-- Peran pemantau (D6): hanya membaca arsip HKI, tanpa aksi apa pun.
begin;
\ir _fixtures.psql
select plan(14);

select tests.login('pemantau');
select is(tests.visible(), array['arc'], 'pemantau hanya melihat dokumen terarsip');
select is(tests.visible_files(), array['arc'], 'pemantau hanya membaca berkas dokumen terarsip');
select ok((select count(*) > 0 from public.hki_persons where record_id = tests.rid('arc')),
  'pemantau dapat membaca pencipta dokumen terarsip');
select throws_like(format('select public.hki_record_meta(%L)', tests.rid('sub')),
  'NOT_FOUND%', 'dokumen yang belum terarsip tidak terlihat');

select lives_ok('select public.hki_accept_privacy()', 'pemantau dapat menyetujui pemberitahuan privasi');
select throws_like('select public.hki_create_record()', 'FORBIDDEN%', 'pemantau tidak mengunggah dokumen');
select throws_like(format($$select public.hki_update_fields(%L, %s, '{"judul": "ubah"}')$$, tests.rid('arc'), tests.versi('arc')),
  'NOT_FOUND%', 'pemantau tidak dapat mengubah dokumen');
select throws_like(format($$select public.hki_review(%L, %s, 'approve')$$, tests.rid('arc'), tests.versi('arc')),
  'FORBIDDEN%', 'pemantau tidak dapat memvalidasi');
select throws_like(format($$select public.hki_request_correction(%L, 'Judul salah')$$, tests.rid('arc')),
  'FORBIDDEN%', 'pemantau tidak dapat meminta koreksi');
select is(public.hki_record_meta(tests.rid('arc')) -> 'caps',
  '{"edit": false, "delete": false, "review": false, "submit": false, "upload": false, "extract": false,
    "correction": false, "edit_persons": false}'::jsonb,
  'semua kapabilitas aksi pemantau bernilai false');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('haki-files', 'records/%s/x.pdf')$$, tests.rid('arc')),
  '42501', null, 'pemantau tidak dapat mengunggah berkas ke penyimpanan');
select throws_ok($$insert into public.hki_master_items (kategori, nilai, label) values ('sumber_dana', 'tu_x', 'X')$$,
  '42501', null, 'pemantau tidak dapat menambah master');
select lives_ok('select count(*) from public.penelitian', 'pemantau tetap membaca data penelitian');
select is_empty('select 1 from public.audit_logs', 'pemantau tidak membaca log audit');

select * from finish();
rollback;
