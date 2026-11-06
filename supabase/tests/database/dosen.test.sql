-- Peran dosen: pemilik, pencipta yang disarankan/terkonfirmasi, dan dosen unit lain.
begin;
\ir _fixtures.psql
select plan(33);

-- ---------- visibilitas ----------
select tests.login('owner');
select is(tests.visible(), array['arc', 'sub', 'sub2', 'wip'], 'pemilik melihat semua dokumennya sendiri');
select is(tests.visible_files(), array['arc', 'sub', 'sub2', 'wip'], 'pemilik dapat membaca berkas dokumennya');

select tests.login('outsider');
select is(tests.visible(), array['osub'], 'dosen unit lain hanya melihat dokumennya sendiri');
select is(tests.visible_files(), array['osub'], 'dosen unit lain tidak dapat membaca berkas dokumen orang lain');
select throws_like(format('select public.hki_record_meta(%L)', tests.rid('arc')),
  'NOT_FOUND%', 'dokumen orang lain dijawab NOT_FOUND (bukan FORBIDDEN)');

select tests.login('coauthor');
select is(tests.visible(), '{}'::text[], 'pencipta berstatus disarankan belum melihat dokumen');
select is(tests.visible_files(), '{}'::text[], 'pencipta berstatus disarankan belum membaca berkas');
select is(
  (select array_agg(distinct k order by k) from jsonb_array_elements(public.hki_my_suggestions()) e, jsonb_object_keys(e) k),
  array['created_at', 'jenis', 'judul', 'nama_tertulis', 'pengunggah', 'peran', 'person_id'],
  'kartu konfirmasi hanya berisi ringkasan, tanpa berkas atau pencipta lain');

-- ---------- konfirmasi pencipta ----------
select lives_ok(format('select public.hki_claim_person(%s, true)', tests.person_id('arc', 990002)),
  'pencipta mengonfirmasi keterlibatan');
select is(tests.visible(), array['arc'], 'setelah konfirmasi, pencipta melihat dokumen tersebut saja');
select lives_ok(format('select public.hki_claim_person(%s, false)', tests.person_id('sub', 990002)),
  'pencipta menolak saran (bukan saya)');
select is_empty('select 1 from public.hki_person_rejections', 'tabel penolakan tidak terbaca dosen');
reset role;
select is((select count(*)::int from public.hki_person_rejections where record_id = tests.rid('sub') and dosen_id = 990002),
  1, 'penolakan tersimpan agar pencocokan ulang tidak menyarankan dosen yang sama');
select tests.login('coauthor');
select is(tests.visible(), array['arc'], 'saran yang ditolak tidak membuka akses');

-- ---------- koreksi arsip ----------
select tests.login('outsider');
select throws_like(format($$select public.hki_request_correction(%L, 'salah ketik')$$, tests.rid('arc')),
  'NOT_FOUND%', 'dosen yang tidak terkait tidak dapat meminta koreksi');
select tests.login('coauthor');
select throws_like(format($$select public.hki_request_correction(%L, 'x')$$, tests.rid('arc')),
  'REASON_REQUIRED%', 'alasan koreksi minimal 3 karakter');
select lives_ok(format($$select public.hki_request_correction(%L, 'Judul salah ketik')$$, tests.rid('arc')),
  'pencipta terkonfirmasi dapat meminta koreksi');
select is(tests.status('arc'), 'CORRECTION_REQUESTED', 'dokumen arsip berpindah ke permintaan koreksi');

-- ---------- membuat dan mengajukan ----------
select throws_like('select public.hki_create_record()', 'PRIVACY_REQUIRED%',
  'unggah ditolak sebelum menyetujui pemberitahuan privasi');

select tests.login('owner');
select throws_like('select public.hki_create_record(990003)', 'FORBIDDEN%',
  'dosen tidak boleh mengunggah atas nama dosen lain');
select lives_ok('select public.hki_create_record(null, true)', 'dosen dapat membuat rekaman manual');
select throws_ok($$insert into public.hki_records (owner_dosen_id, workflow_status) values (990001, 'ARCHIVED')$$,
  '42501', null, 'insert langsung ke hki_records ditolak (wajib lewat RPC)');
select throws_ok(format($$update public.hki_records set workflow_status = 'ARCHIVED' where id = %L$$, tests.rid('wip')),
  '42501', null, 'update langsung status workflow ditolak');

select throws_like(format('select public.hki_submit(%L, %s, false)', tests.rid('wip'), tests.versi('wip')),
  'STATEMENT_REQUIRED%', 'pengajuan wajib mencentang pernyataan kebenaran');
select throws_like(format('select public.hki_submit(%L, %s, true)', tests.rid('wip'), tests.versi('wip') - 1),
  'VERSION_CONFLICT%', 'versi usang ditolak (optimistic locking)');
select lives_ok(format('select public.hki_submit(%L, %s, true)', tests.rid('wip'), tests.versi('wip')),
  'pemilik mengajukan dokumen lengkap');
select is(tests.status('wip'), 'SUBMITTED', 'status menjadi SUBMITTED');
select throws_like(format($$select public.hki_update_fields(%L, %s, '{"judul": "ubah"}')$$, tests.rid('sub'), tests.versi('sub')),
  'NOT_FOUND%', 'dokumen yang sudah diajukan tidak bisa diubah pemilik');
select throws_like(format($$select public.hki_review(%L, %s, 'approve')$$, tests.rid('sub'), tests.versi('sub')),
  'FORBIDDEN%', 'dosen tidak dapat memvalidasi dokumennya sendiri');
select throws_like(format('select public.hki_bulk_approve(array[%L]::uuid[])', tests.rid('sub')),
  'FORBIDDEN%', 'dosen tidak dapat menyetujui massal');

-- ---------- area admin ----------
select is_empty('select 1 from public.audit_logs', 'dosen tidak membaca log audit');
select throws_ok($$insert into public.hki_master_items (kategori, nilai, label) values ('sumber_dana', 'tu_x', 'X')$$,
  '42501', null, 'dosen tidak dapat menambah master');
select throws_like('select public.hki_ai_stats()', 'FORBIDDEN%', 'statistik AI hanya untuk admin');

select * from finish();
rollback;
