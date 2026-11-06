-- Peran admin: mengelola pengguna, unit, master, pengaturan, dan log audit,
-- tetapi TIDAK otomatis melihat dokumen HKI (D5).
begin;
\ir _fixtures.psql
select plan(26);

-- ---------- D5: tanpa akses dokumen ----------
select tests.login('admin');
select is(tests.visible(), '{}'::text[], 'admin tidak melihat dokumen HKI');
select is(tests.visible_files(), '{}'::text[], 'admin tidak membaca berkas HKI');
select is_empty(format('select 1 from public.hki_persons where record_id = %L', tests.rid('arc')), 'admin tidak membaca pencipta');
select is_empty(format('select 1 from public.hki_field_values where record_id = %L', tests.rid('arc')), 'admin tidak membaca isi field');
select is_empty(format('select 1 from public.hki_record_list where id = %L', tests.rid('arc')), 'view daftar juga tertutup bagi admin');
select throws_like(format('select public.hki_record_meta(%L)', tests.rid('arc')), 'NOT_FOUND%', 'detail dokumen dijawab NOT_FOUND');
select throws_like(format($$select public.hki_review(%L, %s, 'approve')$$, tests.rid('sub'), tests.versi('sub')),
  'NOT_FOUND%', 'admin tidak dapat memvalidasi');
select lives_ok('select public.hki_accept_privacy()', 'admin dapat menyetujui pemberitahuan privasi');
select throws_like('select public.hki_create_record()', 'FORBIDDEN%', 'admin tidak mengunggah dokumen');

-- ---------- log audit ----------
select ok((select count(*) > 0 from public.audit_logs where target_id = tests.rid('arc')::text), 'admin membaca log audit');
select ok(not exists (select 1 from public.audit_logs where detail::text like '%Ciptaan uji%'),
  'log audit tidak memuat judul dokumen');
select throws_ok('update public.audit_logs set aksi = aksi', '42501', null, 'admin tidak dapat mengubah log audit');
select throws_ok('delete from public.audit_logs', '42501', null, 'admin tidak dapat menghapus log audit');
reset role;
select throws_like('delete from public.audit_logs', 'AUDIT_APPEND_ONLY%', 'log audit append-only bahkan untuk superuser');

-- ---------- unit, master, pengaturan, statistik AI ----------
select tests.login('admin');
select lives_ok($$insert into public.units (nama, tipe, parent_id) values ('TU Prodi A2', 'prodi', 990002)$$, 'admin menambah unit');
select throws_like('update public.units set parent_id = 990004 where id = 990001', 'UNIT_CYCLE%', 'hierarki unit tidak boleh berputar');
select lives_ok($$insert into public.hki_master_items (kategori, nilai, label, urutan) values ('jenis_ciptaan', 'tu_mural', 'Mural', 99)$$,
  'admin menambah item master');
select throws_ok($$delete from public.hki_master_items where nilai = 'tu_mural'$$, '42501', null,
  'item master tidak dapat dihapus (hanya dinonaktifkan)');
select lives_ok($$update public.hki_settings set value = 'true'::jsonb where key = 'ai.enabled'$$, 'admin mengubah pengaturan AI');
select lives_ok('select public.hki_ai_stats()', 'admin melihat statistik biaya AI');

-- ---------- pengguna & peran ----------
select lives_ok(format($$update public.profiles set role = 'pemantau', dosen_id = null where id = %L$$, tests.uid('outsider')),
  'admin mengubah peran pengguna');
select throws_like(format($$update public.profiles set role = 'operator', unit_id = null where id = %L$$, tests.uid('pemantau')),
  'UNIT_REQUIRED%', 'operator wajib punya unit');

reset role;
update public.profiles set role = 'dosen' where role = 'admin' and id <> tests.uid('admin');
select tests.login('admin');
select throws_like(format($$update public.profiles set role = 'dosen' where id = %L$$, tests.uid('admin')),
  'LAST_ADMIN%', 'admin terakhir tidak dapat menurunkan perannya');

-- ---------- non-admin tidak dapat melakukan hal di atas ----------
select tests.login('owner');
update public.hki_settings set value = 'false'::jsonb where key = 'ai.enabled';
update public.profiles set role = 'admin' where id = auth.uid();
select throws_ok($$insert into public.units (nama, tipe) values ('TU Liar', 'fakultas')$$, '42501', null,
  'non-admin tidak dapat menambah unit');
reset role;
select is((select value from public.hki_settings where key = 'ai.enabled'), 'true'::jsonb,
  'non-admin tidak dapat mengubah pengaturan (diabaikan RLS)');
select is((select role from public.profiles where id = tests.uid('owner')), 'dosen',
  'non-admin tidak dapat menaikkan perannya sendiri');

select * from finish();
rollback;
