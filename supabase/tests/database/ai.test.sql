-- Alur AI: gerbang start, apply/failed hanya service_role, hasil apply, batas baca ulang, sapu stale.
begin;
\ir _fixtures.psql
grant usage on schema tests to service_role;
grant select, insert on tests.records, tests.users to authenticated, service_role;
grant execute on function tests.rid(text) to service_role;

select plan(31);

-- pengaturan live tidak boleh mempengaruhi tes (transaksi di-rollback)
update public.hki_settings set value = 'false'::jsonb where key = 'ai.enabled';

-- ---------- gerbang start_extraction ----------
select tests.login('owner');
select throws_like(format('select public.hki_start_extraction(%L)', tests.rid('wip')),
  'AI_DISABLED%', 'pembacaan ditolak saat ai.enabled false');

reset role;
update public.hki_settings set value = 'true'::jsonb where key = 'ai.enabled';

select tests.login('owner');
insert into tests.records values ('ai1', public.hki_create_record());
select throws_like(format('select public.hki_start_extraction(%L)', tests.rid('ai1')),
  'NO_MAIN_FILE%', 'pembacaan ditolak tanpa berkas utama');

insert into storage.objects (bucket_id, name) values ('haki-files', 'records/' || tests.rid('ai1') || '/main.pdf');
select lives_ok(format(
  $$select public.hki_register_file(%L, 'records/%s/main.pdf', 'main.pdf', 'application/pdf', 1000, %L, 2)$$,
  tests.rid('ai1'), tests.rid('ai1'), encode(extensions.digest('ai1', 'sha256'), 'hex')),
  'berkas utama terdaftar pada draf');
select is(tests.status('ai1'), 'DRAFT', 'unggah berkas tidak mengubah draf saat AI aktif');

select lives_ok(format('select public.hki_start_extraction(%L)', tests.rid('ai1')),
  'pembacaan pertama dari DRAFT berhasil');
select is(tests.status('ai1'), 'EXTRACTING', 'status menjadi EXTRACTING');
reset role;
select is((select reread_count from public.hki_records where id = tests.rid('ai1')), 0,
  'pembacaan pertama dari DRAFT tidak dihitung sebagai baca ulang');

-- ---------- apply/failed hanya service_role ----------
select tests.login('owner');
select throws_ok(format($$select public.hki_apply_extraction(%L, 'hak_cipta', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb)$$, tests.rid('ai1')),
  '42501', null, 'dosen tidak dapat menerapkan hasil ekstraksi');
select throws_ok(format($$select public.hki_extraction_failed(%L, 'UPSTREAM_ERROR')$$, tests.rid('ai1')),
  '42501', null, 'dosen tidak dapat menandai ekstraksi gagal');

select tests.login('val_a');
select throws_ok(format($$select public.hki_apply_extraction(%L, 'hak_cipta', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb)$$, tests.rid('ai1')),
  '42501', null, 'validator tidak dapat menerapkan hasil ekstraksi');
select throws_ok(format($$select public.hki_extraction_failed(%L, 'UPSTREAM_ERROR')$$, tests.rid('ai1')),
  '42501', null, 'validator tidak dapat menandai ekstraksi gagal');

select tests.login('admin');
select throws_ok(format($$select public.hki_apply_extraction(%L, 'hak_cipta', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb)$$, tests.rid('ai1')),
  '42501', null, 'admin tidak dapat menerapkan hasil ekstraksi');
select throws_ok(format($$select public.hki_extraction_failed(%L, 'UPSTREAM_ERROR')$$, tests.rid('ai1')),
  '42501', null, 'admin tidak dapat menandai ekstraksi gagal');

reset role;
set local role service_role;
select lives_ok(format(
  $$select public.hki_apply_extraction(%L, 'hak_cipta', %L::jsonb, %L::jsonb, '[]'::jsonb)$$,
  tests.rid('ai1'),
  '{
    "judul": {"value": "Judul dari AI", "confidence": 0.93, "page": 1, "evidence": "Judul dari AI"},
    "no_permohonan": {"value": "EC00202400001", "confidence": 0.9, "page": 1, "evidence": "EC00202400001"},
    "tgl_permohonan": {"value": "2024-03-10", "confidence": 0.9, "page": 1, "evidence": "10 Maret 2024"},
    "no_sertifikat": {"value": "000512345", "confidence": 0.72, "page": 1, "evidence": "000512345"},
    "status_hki": {"value": "terdaftar", "confidence": 0.6, "page": 1, "evidence": "terdaftar"},
    "jenis_ciptaan": {"value": "program_komputer", "confidence": 0.9, "page": 1, "evidence": "Program Komputer"}
  }',
  '[
    {"nama": "Dr. Andi Pemilik, M.Kom.", "nama_normal": "andi pemilik", "peran": "pencipta", "dosen_id": 990001, "confidence": 0.95},
    {"nama": "Citra Kolaborator", "nama_normal": "citra kolaborator", "peran": "pencipta", "dosen_id": 990002, "confidence": 0.9},
    {"nama": "Universitas Uji", "nama_normal": "universitas uji", "peran": "pemegang", "confidence": 0.9}
  ]'
), 'service_role menerapkan hasil ekstraksi');

reset role;
select is(tests.status('ai1'), 'NEEDS_VERIFICATION', 'apply menghasilkan NEEDS_VERIFICATION');
select is((select judul from public.hki_records where id = tests.rid('ai1')), 'Judul dari AI', 'judul terisi dari hasil AI');
select is((select confidence from public.hki_field_values where record_id = tests.rid('ai1') and field = 'judul'),
  0.93, 'field_values menyimpan skor keyakinan');
select is((select status_cocok from public.hki_persons where record_id = tests.rid('ai1') and dosen_id = 990001),
  'dikonfirmasi', 'pemilik ditetapkan dikonfirmasi oleh server');
select is((select status_cocok from public.hki_persons where record_id = tests.rid('ai1') and dosen_id = 990002),
  'disarankan', 'pencipta lain ditetapkan disarankan oleh server');
select is((select status_cocok from public.hki_persons where record_id = tests.rid('ai1') and peran = 'pemegang'),
  'eksternal', 'pemegang tanpa dosen ditetapkan eksternal oleh server');

-- ---------- batas baca ulang ----------
select tests.login('owner');
select lives_ok(format('select public.hki_start_extraction(%L)', tests.rid('ai1')), 'baca ulang ke-1');
reset role;
select is((select reread_count from public.hki_records where id = tests.rid('ai1')), 1, 'reread_count = 1');
set local role service_role;
select lives_ok(format($$select public.hki_extraction_failed(%L, 'UPSTREAM_ERROR')$$, tests.rid('ai1')),
  'service_role menandai gagal');

reset role;
select tests.login('owner');
select lives_ok(format('select public.hki_start_extraction(%L)', tests.rid('ai1')), 'baca ulang ke-2');
reset role;
select is((select reread_count from public.hki_records where id = tests.rid('ai1')), 2, 'reread_count = 2');
set local role service_role;
select public.hki_extraction_failed(tests.rid('ai1'), 'UPSTREAM_ERROR');

reset role;
select tests.login('owner');
select lives_ok(format('select public.hki_start_extraction(%L)', tests.rid('ai1')), 'baca ulang ke-3');
reset role;
select is((select reread_count from public.hki_records where id = tests.rid('ai1')), 3, 'reread_count = 3');
set local role service_role;
select public.hki_extraction_failed(tests.rid('ai1'), 'UPSTREAM_ERROR');

reset role;
select tests.login('owner');
select throws_like(format('select public.hki_start_extraction(%L)', tests.rid('ai1')),
  'REREAD_LIMIT%', 'baca ulang ke-4 ditolak');

-- ---------- sapu EXTRACTING macet ----------
reset role;
update public.hki_records
  set workflow_status = 'EXTRACTING', extra = extra - 'extraction_error',
      updated_at = now() - interval '10 minutes'
  where id = tests.rid('ai1');
select is(public.hki_sweep_stale(), 1, 'sapu menandai 1 dokumen macet');
select is(tests.status('ai1'), 'EXTRACTION_FAILED', 'dokumen macet menjadi EXTRACTION_FAILED');
select is((select extra ->> 'extraction_error' from public.hki_records where id = tests.rid('ai1')),
  'TIMEOUT', 'kode galat sapu adalah TIMEOUT');

select * from finish();
rollback;
