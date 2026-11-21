import { expect, test, type Page, type Route } from '@playwright/test';
import { demo, documentId, documentPath } from './fixtures';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'content-range',
};

async function pageResponse(route: Route, rows: object[], from: number, size: number) {
  if (route.request().method() === 'HEAD') {
    return route.fulfill({ headers: { ...cors, 'content-range': '*/' + rows.length } });
  }
  if (from >= rows.length && from > 0) {
    return route.fulfill({ status: 416, headers: cors, json: { code: 'PGRST103', message: 'Range not satisfiable' } });
  }
  const data = rows.slice(from, from + size);
  return route.fulfill({
    headers: { ...cors, 'content-range': data.length ? `${from}-${from + data.length - 1}/${rows.length}` : '*/0' },
    json: data,
  });
}

async function researchList(page: Page, count: number) {
  let rows = Array.from({ length: count }, (_, i) => ({
    id: i + 1, judul_penelitian: 'Penelitian ' + String(i + 1).padStart(2, '0'),
    dosen_id: 71, dosen: { nama: 'Dosen Uji' }, tahun: i % 2 === 0 ? 2025 : 2026,
  }));
  const requests: { method: string; offset: number; size: number; order: string; relations: string | null }[] = [];
  await page.route('**/rest/v1/penelitian?*', async (route) => {
    const request = route.request();
    const params = new URL(request.url()).searchParams;
    if (request.method() === 'OPTIONS') return route.fallback();
    if (request.method() === 'DELETE') {
      rows = rows.filter((row) => params.get('id') !== 'eq.' + row.id);
      return route.fulfill({ status: 204, headers: cors });
    }
    const order = params.get('order') ?? '';
    const offset = Number(params.get('offset') ?? 0);
    const size = Number(params.get('limit') ?? 1000);
    requests.push({ method: request.method(), offset, size, order, relations: params.get('match_anggota.match_dosen.nama') });
    const result = rows.filter((row) => !params.has('tahun') || params.get('tahun') === 'eq.' + row.tahun);
    if (order.startsWith('judul_penelitian.desc')) result.sort((a, b) => b.id - a.id);
    else if (order.startsWith('judul_penelitian.asc')) result.sort((a, b) => a.id - b.id);
    else result.sort((a, b) => b.tahun - a.tahun || a.id - b.id);
    return pageResponse(route, result, offset, size);
  });
  return requests;
}

test('paginasi dan sortir akademik bekerja lintas halaman dan ukuran layar', async ({ page }) => {
  const fixture = await demo(page);
  const requests = await researchList(page, 34);
  await fixture.login('/penelitian?q=Penelitian&page=2');
  const table = page.getByRole('table', { name: 'Penelitian', exact: true });
  const pager = page.getByRole('navigation', { name: 'Paginasi' });
  await expect(pager).toContainText('Menampilkan 11 sampai 20 dari 34');
  expect(requests.at(-1)).toMatchObject({ offset: 10, size: 10, relations: 'ilike.%Penelitian%' });

  await pager.getByLabel('Baris per halaman').selectOption('25');
  await expect(pager).toContainText('Menampilkan 1 sampai 25 dari 34');
  await expect(page).toHaveURL((url) => url.hash === '#/penelitian?q=Penelitian&size=25');
  await page.getByLabel('Urutkan').selectOption('judul:desc');
  await expect(table.locator('tbody tr').first()).toContainText('Penelitian 34');
  await expect(table.getByRole('columnheader', { name: 'Judul Penelitian' })).toHaveAttribute('aria-sort', 'descending');

  const next = pager.getByRole('button', { name: 'Halaman berikutnya' });
  await next.press('Enter');
  await expect(table.locator('tbody tr').first()).toContainText('Penelitian 09');
  await expect(next).toBeFocused();
  await expect(pager.getByRole('button', { name: 'Halaman 2', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(requests.at(-1)).toMatchObject({ offset: 25, size: 25, order: 'judul_penelitian.desc.nullslast,id.asc' });

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(pager).toContainText('Halaman 2 dari 2');
  const jump = pager.getByLabel('Ke halaman');
  await jump.fill('1');
  await jump.press('Enter');
  await expect(pager).toContainText('Halaman 1 dari 2');
  await page.getByLabel('Tahun', { exact: true }).fill('2025');
  await expect(pager).toContainText('Menampilkan 1 sampai 17 dari 17');
  await expect(page).toHaveURL((url) => url.hash.includes('sort=judul&dir=desc&tahun=2025'));
});

test('menghapus baris terakhir mengembalikan daftar ke halaman terakhir yang tersedia', async ({ page }) => {
  const fixture = await demo(page);
  const requests = await researchList(page, 26);
  await fixture.login('/penelitian?q=Penelitian&sort=judul&size=25&page=2');
  const table = page.getByRole('table', { name: 'Penelitian', exact: true });
  const pager = page.getByRole('navigation', { name: 'Paginasi' });
  await expect(pager).toContainText('Menampilkan 26 sampai 26 dari 26');
  await table.getByText('Rincian', { exact: true }).click();
  await table.getByRole('button', { name: 'Hapus', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Konfirmasi penghapusan' });
  await expect(dialog.getByRole('button', { name: 'Batal' })).toBeFocused();
  await expect(dialog).toContainText('Penelitian 26');
  await dialog.getByRole('button', { name: 'Hapus', exact: true }).click();
  await expect(pager).toContainText('Menampilkan 1 sampai 25 dari 25');
  await expect(page).toHaveURL((url) => url.hash === '#/penelitian?q=Penelitian&sort=judul&size=25');
  expect(requests.filter((request) => request.method === 'HEAD')).toHaveLength(1);
  await expect(table.getByText('Penelitian 26')).toHaveCount(0);
});

test('combobox mencari di luar seribu dosen dan mengabaikan jawaban lama', async ({ page }) => {
  const fixture = await demo(page);
  const directory = Array.from({ length: 1100 }, (_, i) => ({ id: 100 + i, nama: 'Dosen ' + i }));
  directory[1099].nama = 'Zulaikha Terakhir';
  let release = () => {};
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  let failures = 0;
  const limits: number[] = [];
  await page.route('**/rest/v1/dosen?*', async (route) => {
    const parameters = new URL(route.request().url()).searchParams;
    const term = parameters.get('nama')?.match(/^ilike\.%(.+)%$/)?.[1];
    if (!term || route.request().method() !== 'GET') return route.fallback();
    limits.push(Number(parameters.get('limit')));
    if (term === 'Dosen 10') await delayed;
    if (term === 'Zulaikha' && failures++ === 0) {
      return route.fulfill({ status: 400, headers: cors, json: { message: 'Uji gagal sekali' } });
    }
    const hits = directory.filter((row) => row.nama.includes(term));
    await route.fulfill({ headers: cors, json: hits.slice(0, Number(parameters.get('limit'))) }).catch(() => undefined);
  });
  await fixture.login('/penelitian?q=Penelitian');
  await page.getByRole('button', { name: 'Tambah penelitian' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tambah penelitian' });
  const picker = dialog.getByRole('combobox', { name: 'Cari dosen untuk tim peneliti' });
  const started = page.waitForRequest((request) => new URL(request.url()).searchParams.get('nama') === 'ilike.%Dosen 10%');
  await picker.fill('Dosen 10');
  await started;
  await picker.fill('Zulaikha');
  await expect(dialog.getByRole('alert')).toContainText('Pilihan gagal dimuat.');
  await dialog.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(dialog.getByRole('option', { name: 'Zulaikha Terakhir' })).toBeVisible();
  release();
  await expect(dialog.getByRole('option', { name: /^Dosen 10/ })).toHaveCount(0);
  await picker.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(picker).toHaveAttribute('aria-expanded', 'false');

  await picker.fill('Zulaikha');
  await dialog.getByRole('option', { name: 'Zulaikha Terakhir' }).click();
  const members = dialog.getByRole('list', { name: 'Tim Peneliti terpilih' });
  await expect(members).toContainText('Zulaikha Terakhir');
  const leader = dialog.getByRole('combobox', { name: 'Ketua', exact: true });
  await leader.press('ArrowDown');
  await dialog.getByRole('option', { name: 'Zulaikha Terakhir' }).click();
  await expect(leader).toHaveValue('Zulaikha Terakhir');
  await members.getByRole('button', { name: 'Hapus Zulaikha Terakhir' }).click();
  await expect(leader).toHaveValue('');
  await expect(dialog.getByRole('alert')).toContainText('Pilih kembali ketua');
  expect(limits).toEqual(limits.map(() => 20));
});

test('pemilih operator menerapkan unit dan turunannya sebelum batas hasil', async ({ page }) => {
  const fixture = await demo(page, 'operator');
  await page.route('**/rest/v1/units?*', (route) => route.request().method() === 'OPTIONS' ? route.fallback()
    : route.fulfill({ headers: cors, json: [{ id: 1, nama: 'Fakultas Uji' }, { id: 2, nama: 'Prodi Uji', parent_id: 1 }, { id: 3, nama: 'Unit lain' }] }));
  let search: URLSearchParams | undefined;
  await page.route('**/rest/v1/dosen?*', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fallback();
    search = new URL(request.url()).searchParams;
    const rows = [{ id: 1100, nama: 'Dosen Prodi Uji', unit_id: 2 }, { id: 1200, nama: 'Dosen Unit Lain', unit_id: 3 }];
    const scope = search.get('unit_id')?.slice(4, -1).split(',') ?? [];
    return route.fulfill({ headers: cors, json: rows.filter((row) => scope.includes(String(row.unit_id))) });
  });
  await fixture.login('/haki/unggah');
  const owner = page.getByRole('combobox', { name: 'Atas nama dosen' });
  await owner.fill('Dosen');
  await page.getByRole('option', { name: 'Dosen Prodi Uji' }).click();
  await expect(owner).toHaveValue('Dosen Prodi Uji');
  await expect(page.getByRole('option', { name: 'Dosen Unit Lain' })).toHaveCount(0);
  expect(search?.get('unit_id')).toBe('in.(1,2)');
  expect(search?.get('limit')).toBe('20');
  await expect(page.getByRole('button', { name: 'Pilih berkas', exact: true })).toBeEnabled();
});

test('metadata HKI menampilkan jenis ciptaan nonaktif yang sudah tersimpan', async ({ page }) => {
  const fixture = await demo(page);
  await page.route('**/rest/v1/hki_master_items?*', (route) => route.request().method() !== 'GET' ? route.fallback()
    : route.fulfill({ headers: cors, json: [
      { id: 1, kategori: 'jenis_ciptaan', nilai: 'program_komputer', label: 'Program lama', aktif: false, urutan: 1 },
      { id: 2, kategori: 'jenis_ciptaan', nilai: 'buku', label: 'Buku', aktif: true, urutan: 2 },
      { id: 3, kategori: 'jenis_ciptaan', nilai: 'lagu', label: 'Lagu lama', aktif: false, urutan: 3 },
    ] }));
  await fixture.login(documentPath);
  const master = page.getByRole('combobox', { name: 'Jenis ciptaan' });
  await expect(master).toHaveValue('Program lama (nonaktif)');
  await master.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Program lama (nonaktif)' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Lagu lama (nonaktif)' })).toHaveCount(0);
  await page.getByRole('option', { name: 'Buku', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 perubahan belum tersimpan' })).toBeVisible();
  expect(fixture.versionCalls).toEqual([]);
});

test('Tab meninggalkan pemilih pencipta tanpa menautkan dosen', async ({ page }) => {
  const fixture = await demo(page);
  const links: object[] = [];
  let searches = 0;
  let release = () => {};
  const nextSearch = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/rest/v1/hki_persons?*', (route) => route.request().method() !== 'GET' ? route.fallback()
    : route.fulfill({ headers: cors, json: [
      { id: 11, record_id: documentId, nama: 'Pencipta Uji', peran: 'pencipta', status_cocok: 'eksternal', dosen_id: null },
    ] }));
  await page.route('**/rest/v1/rpc/hki_lecturer_search', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    if (++searches === 2) await nextSearch;
    return route.fulfill({ headers: cors, json: [{ id: 72, nama: 'Dosen Uji', unit: 'Unit Uji', nidn: '••••0002' }] });
  });
  await page.route('**/rest/v1/rpc/hki_link_person', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    links.push(route.request().postDataJSON());
    return route.fulfill({ headers: cors, json: 2 });
  });
  await fixture.login(documentPath);
  await page.getByRole('button', { name: 'Tautkan', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Cari nama dosen' });
  const candidate = page.getByRole('option', { name: /Dosen Uji/ });
  await picker.fill('Dosen');
  await expect(candidate).toBeVisible();
  await picker.press('ArrowDown');
  await picker.press('Tab');
  await expect(picker).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Batal', exact: true })).toBeFocused();
  expect(links).toEqual([]);

  await picker.fill('Dosen');
  await expect(candidate).toHaveCount(0);
  release();
  await expect(candidate).toBeVisible();
  await picker.press('ArrowDown');
  await picker.press('Enter');
  await expect.poll(() => links).toEqual([{ p_record: documentId, p_versi: 1, p_person: 11, p_dosen: 72 }]);
});

test('ekspor arsip memakai semua hasil filter meski daftar berada di halaman kedua', async ({ page }) => {
  const fixture = await demo(page, 'pemantau');
  const requests: { offset: number; size: number; year: string | null }[] = [];
  const rows = Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1), judul: 'Arsip ' + String(i + 1), workflow_status: 'ARCHIVED', tahun: 2025,
  }));
  await page.route('**/rest/v1/hki_record_list?*', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fallback();
    const params = new URL(request.url()).searchParams;
    const offset = Number(params.get('offset') ?? 0);
    const size = Number(params.get('limit') ?? 1000);
    requests.push({ offset, size, year: params.get('tahun') });
    return pageResponse(route, rows, offset, size);
  });
  await fixture.login('/haki/arsip?tahun=2025&size=10&page=2');
  await expect(page.getByRole('navigation', { name: 'Paginasi' })).toContainText('Menampilkan 11 sampai 12 dari 12');
  await page.getByText('Ekspor', { exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^arsip-hki-.*\.csv$/);
  expect(requests).toContainEqual({ offset: 0, size: 1000, year: 'eq.2025' });
});
