-- Peran validator: cakupan unit, keputusan validasi, persetujuan massal, master HAKI.
begin;
\ir _fixtures.psql
select plan(30);

-- ---------- cakupan unit ----------
select tests.login('val_a');
select is(tests.visible(), array['arc', 'sub', 'sub2', 'wip'], 'validator fakultas A melihat dokumen unit turunannya');
select is(tests.visible_files(), array['arc', 'sub', 'sub2', 'wip'], 'validator fakultas A membaca berkas dalam cakupannya');
select throws_like(format($$select public.hki_review(%L, %s, 'approve')$$, tests.rid('osub'), tests.versi('osub')),
  'NOT_FOUND%', 'validator tidak dapat memutuskan dokumen di luar unitnya');

select tests.login('val_b');
select is(tests.visible(), array['osub'], 'validator fakultas B hanya melihat dokumen unitnya');

-- ---------- notifikasi ----------
select tests.login('val_a');
select is((select count(*)::int from public.notifications where tipe = 'submitted'
           and record_id in (tests.rid('sub'), tests.rid('sub2'))), 2,
  'validator dalam cakupan menerima notifikasi pengajuan');
select is_empty('select 1 from public.notifications where user_id <> auth.uid()', 'validator hanya membaca notifikasinya sendiri');
select tests.login('val_b');
select is_empty(format('select 1 from public.notifications where record_id = %L', tests.rid('sub')),
  'validator di luar cakupan tidak diberi notifikasi');

-- ---------- persetujuan massal ----------
select tests.login('val_a');
select is(public.hki_bulk_approve(array[tests.rid('sub')]) -> 'skipped' -> 0 ->> 'reason', 'NO_AI_DATA',
  'persetujuan massal menolak dokumen tanpa hasil AI');
select is(tests.status('sub'), 'SUBMITTED', 'dokumen yang dilewati tetap menunggu validasi');
select throws_like('select public.hki_bulk_approve(array[]::uuid[])', 'BULK_LIMIT%', 'persetujuan massal minimal 1 dokumen');

-- ---------- keputusan tunggal ----------
select throws_like(format($$select public.hki_review(%L, %s, 'reject')$$, tests.rid('sub2'), tests.versi('sub2')),
  'NOTE_REQUIRED%', 'penolakan wajib beralasan');
select throws_like(format($$select public.hki_review(%L, %s, 'request_revision')$$, tests.rid('sub2'), tests.versi('sub2')),
  'NOTE_REQUIRED%', 'permintaan revisi wajib bercatatan');
select throws_like(format($$select public.hki_review(%L, %s, 'approve')$$, tests.rid('sub2'), tests.versi('sub2') - 1),
  'VERSION_CONFLICT%', 'keputusan atas versi usang ditolak');

select lives_ok(format($$select public.hki_update_fields(%L, %s, '{"no_sertifikat": "tu-arc-1"}')$$, tests.rid('sub2'), tests.versi('sub2')),
  'validator dapat mengubah field dokumen yang menunggu validasi');
select throws_like(format($$select public.hki_review(%L, %s, 'approve')$$, tests.rid('sub2'), tests.versi('sub2')),
  'CERT_DUPLICATE%', 'nomor sertifikat yang sudah terarsip (dinormalisasi) ditolak');
select lives_ok(format($$select public.hki_review(%L, %s, 'request_revision', null, '{"no_sertifikat": "Periksa nomor"}')$$,
  tests.rid('sub2'), tests.versi('sub2')), 'catatan per field cukup untuk meminta revisi');
select is(tests.status('sub2'), 'NEEDS_REVISION', 'dokumen kembali ke pemilik untuk revisi');

select lives_ok(format($$select public.hki_review(%L, %s, 'approve')$$, tests.rid('sub'), tests.versi('sub')),
  'validator menyetujui dokumen dalam cakupannya');
select is(tests.status('sub'), 'ARCHIVED', 'dokumen yang disetujui menjadi ARCHIVED');
select throws_like(format($$select public.hki_review(%L, %s, 'approve')$$, tests.rid('arc'), tests.versi('arc')),
  'INVALID_TRANSITION%', 'dokumen terarsip tidak dapat diputuskan ulang');

select tests.login('val_b');
select lives_ok(format($$select public.hki_review(%L, %s, 'reject', 'Bukan dokumen HKI')$$, tests.rid('osub'), tests.versi('osub')),
  'validator menolak dengan alasan');

reset role;
select ok((select locked and validated_by = tests.uid('val_a') and validated_at is not null
           from public.hki_records where id = tests.rid('sub')),
  'persetujuan mengunci dokumen dan mencatat validator');
select is((select array_agg(tipe order by tipe) from public.notifications
           where user_id = tests.uid('owner') and tipe like 'review_%'),
  array['review_approved', 'review_approved', 'review_revision'], 'pemilik diberi tahu setiap keputusan');
select is(tests.status('osub'), 'REJECTED', 'dokumen yang ditolak berstatus REJECTED');

-- ---------- batas peran ----------
select tests.login('val_a');
select lives_ok('select public.hki_accept_privacy()', 'validator dapat menyetujui pemberitahuan privasi');
select throws_like('select public.hki_create_record()', 'FORBIDDEN%', 'validator tidak mengunggah dokumen');
select throws_like(format('select public.hki_submit(%L, %s, true)', tests.rid('wip'), tests.versi('wip')),
  'FORBIDDEN%', 'validator tidak mengajukan atas nama dosen');
select is_empty('select 1 from public.audit_logs', 'validator tidak membaca log audit');

-- ---------- master HAKI ----------
select lives_ok($$insert into public.hki_master_items (kategori, nilai, label, urutan) values ('sumber_dana', 'tu_hibah', 'Hibah Uji', 99)$$,
  'validator dapat menambah item master');
select throws_like($$update public.hki_master_items set nilai = 'tu_ganti' where nilai = 'tu_hibah'$$,
  'MASTER_KEY_LOCKED%', 'kode master tidak dapat diubah setelah dibuat');

select * from finish();
rollback;
