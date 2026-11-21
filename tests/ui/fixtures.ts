import { expect, type Page } from '@playwright/test';

type Role = 'dosen' | 'operator' | 'validator' | 'pemantau' | 'admin';
type Failure = 'connection' | 'conflict';
const userId = 'b0000000-0000-4000-8000-000000000001';
export const documentId = 'a0000000-0000-4000-8000-000000000001';
export const documentPath = '/haki/dokumen/' + documentId;
const now = '2025-05-18T08:00:00.000Z';
const settings = [
  { key: 'ai.enabled', value: false },
  { key: 'ai.confidence_high', value: 0.85 },
  { key: 'ai.confidence_low', value: 0.5 },
];

export async function demo(page: Page, role: Role = 'dosen', options: { failFirstSave?: Failure; archiveTotal?: number } = {}) {
  const record = {
    id: documentId, judul: 'Sertifikat uji antarmuka', jenis: 'hak_cipta',
    no_permohonan: 'UI-2025-001', no_sertifikat: null, tgl_permohonan: '2025-05-18',
    status_hki: null, berlaku_mulai: null, berlaku_akhir: null, sumber_dana: null,
    kegiatan_terkait: null, pdki_url: null, unit_id: 1, owner_dosen_id: 71,
    created_by: userId, workflow_status: role === 'validator' ? 'SUBMITTED' : role === 'pemantau' ? 'ARCHIVED' : 'NEEDS_VERIFICATION',
    extra: { jenis_ciptaan: 'program_komputer' }, versi: 1, locked: false,
    submitted_at: now, validated_at: null, created_at: now, updated_at: now,
    tahun: 2025, owner_nama: 'Dosen Uji', unit_nama: 'Unit Uji', pencipta: 'Dosen Uji',
    pemegang: 'Unit Uji', min_confidence: null,
  };
  const lecturer = { id: 71, nama: 'Dosen Uji', unit_id: 1, nidn: '0000000001', prodi_id: 1 };
  const unit = { id: 1, nama: 'Unit Uji', parent_id: null, tipe: 'prodi' };
  const profile = {
    id: userId, email: role + '@example.test', role,
    dosen_id: role === 'dosen' ? lecturer.id : null, unit_id: 1,
    dosen: role === 'dosen' ? lecturer : null, unit, privacy_notice_accepted_at: now,
  };
  const editable = role === 'dosen' || role === 'operator' || role === 'validator';
  const recordMeta = {
    caps: {
      edit: editable, upload: editable, submit: role === 'dosen', review: role === 'validator',
      correction: false, delete: role === 'dosen' || role === 'operator', extract: false,
      edit_persons: editable,
    },
    is_owner: role === 'dosen', reread_count: 0, max_rereads: 3, problems: [], warnings: [],
    duplicates: { total: 0, items: [] }, bulk_ineligible: null,
  };
  const versionCalls: number[] = [];
  let failure = options.failFirstSave;
  const issued = Math.floor(Date.now() / 1000);
  const tokenPart = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = tokenPart({ alg: 'HS256', typ: 'JWT' }) + '.' + tokenPart({ exp: issued + 3600, sub: userId, role: 'authenticated' }) + '.dWktdGVzdA';
  const tables: Record<string, unknown[]> = {
    profiles: [profile],
    units: [unit],
    dosen: [lecturer, { id: 72, nama: 'Mitra Uji', unit_id: 1 }],
    prodi: [{ id: 1, prodi: 'Program Studi Uji' }],
    hki_settings: settings,
    hki_master_items: [{ id: 1, kategori: 'jenis_ciptaan', nilai: 'program_komputer', label: 'Program komputer', aktif: true, urutan: 1 }],
    hki_field_values: [{ field: 'judul', nilai_ai: record.judul, confidence: 0.92, dikonfirmasi: false, diubah: false, page: 1 }],
    penelitian: [{ id: 1, judul_penelitian: 'Penelitian Uji', dosen_id: 71, tahun: 2025, created_by: userId, dosen: lecturer, penelitian_anggota: [] }],
    artikel_mahasiswa: [],
    audit_logs: [{ id: 1, actor: userId, aksi: 'record.upload', target_type: 'hki_record', target_id: documentId, detail: { status: 'tersimpan' }, created_at: now }],
    hki_aliases: [{ alias: 'D. Uji' }],
  };

  await page.route((url) => url.origin === 'http://127.0.0.1:54399', async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const name = pathname.split('/').at(-1) ?? '';
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
      'access-control-expose-headers': 'content-range',
    };
    const reply = (json: unknown, status = 200, count?: number) => route.fulfill({
      status,
      headers: { ...cors, ...(count == null ? {} : { 'content-range': count ? '0-' + (count - 1) + '/' + count : '*/0' }) },
      ...(request.method() === 'HEAD' || request.method() === 'OPTIONS' ? {} : { json }),
    });

    if (request.method() === 'OPTIONS') return reply(null, 204);
    if (pathname === '/auth/v1/token') return reply({
      access_token: accessToken, refresh_token: 'ui-fixture-refresh-token', expires_in: 3600, expires_at: issued + 3600, token_type: 'bearer',
      user: { id: userId, email: profile.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now },
    });
    if (pathname.includes('/rpc/')) {
      if (name === 'hki_update_fields') {
        const args = request.postDataJSON();
        versionCalls.push(args.p_versi);
        if (failure === 'connection') { failure = undefined; return reply({ message: 'Jaringan uji gagal' }, 503); }
        if (failure === 'conflict') {
          failure = undefined;
          record.judul = 'Perubahan dari server';
          record.versi += 1;
        }
        if (args.p_versi !== record.versi) return reply({ code: 'P0001', message: 'VERSION_CONFLICT: Dokumen telah berubah' }, 409);
        Object.assign(record, args.p_fields);
        record.versi += 1;
        return reply(record.versi);
      }
      const results: Record<string, unknown> = {
        hki_record_meta: recordMeta, hki_history: [], hki_sweep_stale: 0, hki_my_suggestions: [],
        hki_ai_stats: { month_cost: 0, budget: 0, by_model: [], failures: [] },
        rekap_kegiatan: [{ prodi_id: null, prodi: 'Total', penelitian: 1, pengabdian: 0 }],
        tahun_kegiatan: [{ tahun: 2025 }],
      };
      return reply(results[name] ?? null);
    }
    const documents = name === 'hki_records' || name === 'hki_record_list';
    let rows = documents ? (
      role === 'admin' || (searchParams.has('id') && searchParams.get('id') !== 'eq.' + documentId) ? [] : [record]
    ) : tables[name] ?? [];
    const idFilter = searchParams.get('id');
    if (idFilter?.startsWith('eq.')) {
      rows = rows.filter((row) => String((row as { id?: string | number }).id) === idFilter.slice(3));
    }
    return reply(request.headers().accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows, 200, name === 'hki_record_list' ? options.archiveTotal ?? rows.length : rows.length);
  });

  return {
    versionCalls,
    async login(path = '/') {
      await page.goto('/#' + path);
      await page.getByLabel('Email', { exact: true }).fill(profile.email);
      await page.getByLabel('Kata sandi', { exact: true }).fill('test-password');
      await page.getByRole('button', { name: 'Masuk', exact: true }).click();
      await expect(page.locator('main.content').getByRole('heading', { level: 1 })).toBeVisible();
    },
  };
}
