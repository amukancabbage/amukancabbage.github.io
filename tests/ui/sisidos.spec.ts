import { expect, test } from '@playwright/test';
import { demo, documentPath } from './fixtures';

test('menu ponsel memindah fokus dan menutup lewat Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await (await demo(page)).login();
  const toggle = page.getByRole('button', { name: 'Buka menu' });
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
  await expect(nav).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Notifikasi' })).toBeFocused();
  await toggle.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Navigasi SISIDOS' });
  await expect(drawer.getByRole('button', { name: 'Tutup menu' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(drawer.getByRole('link', { name: 'Beranda', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(drawer.getByRole('link', { name: 'HKI Saya', exact: true })).toBeFocused();
  const academic = drawer.getByText('Akademik', { exact: true });
  await page.keyboard.press('Tab');
  await expect(academic).toBeFocused();
  await expect(drawer.getByRole('link', { name: 'Data Penelitian' })).toHaveCount(0);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(drawer.getByRole('link', { name: 'Rekap Akademik' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(toggle).toBeFocused();
});

test('draf bertahan ketika navigasi dibatalkan atau penyimpanan gagal', async ({ page }) => {
  const fixture = await demo(page, 'dosen', { failFirstSave: 'connection' });
  await fixture.login(documentPath);
  const title = page.getByLabel('Judul', { exact: true });
  await title.fill('Draf metadata yang perlu disimpan');
  const link = page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Data Penelitian' });
  const dialog = page.getByRole('dialog', { name: 'Perubahan belum tersimpan' });
  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByText('Akademik', { exact: true }).click();
  await link.click();
  await dialog.getByRole('button', { name: 'Tetap di halaman' }).click();
  await expect(title).toHaveValue('Draf metadata yang perlu disimpan');
  await link.click();
  await dialog.getByRole('button', { name: 'Simpan dan lanjut' }).click();
  await expect(page.getByRole('alert')).toContainText('Jaringan uji gagal');
  await expect(title).toHaveValue('Draf metadata yang perlu disimpan');
  await link.click();
  await dialog.getByRole('button', { name: 'Simpan dan lanjut' }).click();
  await expect(page.getByRole('heading', { name: 'Penelitian', exact: true })).toBeVisible();
  expect(fixture.versionCalls).toEqual([1, 1]);
});

test('konflik versi membandingkan nilai dan simpan ulang memakai versi server', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await demo(page, 'dosen', { failFirstSave: 'conflict' });
  await fixture.login(documentPath);
  const title = page.getByLabel('Judul', { exact: true });
  await title.fill('Perubahan saya');
  await page.getByRole('tab', { name: 'Berkas' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Berkas' })).toBeVisible();
  await page.getByRole('tab', { name: 'Metadata' }).click();
  await expect(title).toHaveValue('Perubahan saya');
  await page.getByRole('button', { name: 'Simpan sekarang' }).click();
  const conflict = page.getByRole('region', { name: 'Konflik versi' });
  await expect(conflict).toContainText('Server: Perubahan dari server');
  await conflict.getByRole('radio', { name: 'Saya: Perubahan saya' }).check();
  await conflict.getByRole('button', { name: 'Gunakan pilihan' }).click();
  await page.getByRole('button', { name: 'Simpan sekarang' }).click();
  await expect(page.getByRole('heading', { name: 'Perubahan saya', exact: true })).toBeVisible();
  expect(fixture.versionCalls).toEqual([1, 2]);
});

test('picker upstream menjaga anggota terkunci dan filter daftar', async ({ page }) => {
  await (await demo(page)).login('/penelitian?q=Penelitian');
  await page.getByRole('button', { name: 'Tambah penelitian' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tambah penelitian' });
  const picker = dialog.getByLabel('Pilih tim peneliti');
  await picker.selectOption('72');
  await dialog.getByRole('button', { name: 'Tambah', exact: true }).click();
  const members = dialog.getByRole('listbox', { name: 'Tim Peneliti' });
  await expect(members.locator('option[value="71"]')).toBeDisabled();
  await expect(members.locator('option[value="72"]')).toHaveText('Mitra Uji');
  await members.selectOption('72');
  await dialog.getByRole('button', { name: 'Hapus', exact: true }).click();
  await expect(members.locator('option[value="72"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Batal' }).click();
  await expect(page.getByLabel('Pencarian')).toHaveValue('Penelitian');
});

const cases = [
  {
    role: 'dosen', primary: 'Unggah sertifikat', routes: ['/beranda', '/rekap-akademik', '/penelitian', '/pengabdian', '/artikel-mahasiswa', '/haki', '/haki/unggah', '/haki/saya', '/haki/konfirmasi', '/haki/arsip', '/haki/profil', '/haki/portofolio', '/haki/notifikasi', '/haki/bantuan', documentPath],
  },
  { role: 'operator', primary: 'Unggah atas nama dosen', routes: ['/beranda', '/haki/unggah', '/haki/saya', documentPath], denied: '/haki/antrean' },
  { role: 'validator', primary: 'Buka antrean validasi', routes: ['/beranda', '/haki/antrean', '/haki/dashboard', '/haki/admin/master', documentPath], denied: '/haki/unggah' },
  { role: 'pemantau', primary: 'Buka arsip HKI', routes: ['/beranda', '/haki/arsip', '/haki/dashboard', documentPath], denied: '/haki/unggah' },
  { role: 'admin', primary: 'Kelola pengguna', routes: ['/beranda', '/dosen', '/prodi', '/unit', '/pengguna', '/kategori-penelitian', '/subkategori-penelitian', '/kategori-pengabdian', '/subkategori-pengabdian', '/haki/admin/ai', '/haki/admin/audit', '/haki/admin/master', documentPath], denied: '/haki/antrean' },
] as const;

for (const entry of cases) {
  test('beranda, akses, dan reflow ' + entry.role, async ({ page }) => {
    const fixture = await demo(page, entry.role);
    await fixture.login();
    await expect(page.getByRole('main').getByRole('link', { name: entry.primary, exact: true })).toBeVisible();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const path of entry.routes) {
      await page.goto('/?view=' + encodeURIComponent(path) + '#' + path);
      await expect(page).toHaveURL((url) => url.hash === '#' + path);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('main [role=status]').filter({ hasText: /^Memuat…$/ })).toHaveCount(0);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ['light', 'dark']) {
          const reflows = await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
            return document.documentElement.scrollWidth <= window.innerWidth;
          }, theme);
          expect(reflows, path + ' ' + width + ' px, tema ' + theme).toBe(true);
        }
      }
      if (path === documentPath && entry.role === 'admin') {
        await expect(page.getByRole('heading', { name: 'Dokumen tidak ditemukan' })).toBeVisible();
      }
      if (path === documentPath && entry.role === 'operator') {
        await expect(page.getByRole('button', { name: 'Ajukan ke validator' })).toHaveCount(0);
      }
    }
    if ('denied' in entry) {
      await page.goto('/#' + entry.denied);
      await expect(page).toHaveURL((url) => url.hash === '#/beranda');
    }
    expect(errors).toEqual([]);
  });
}
test('tombol kembali dan keluar akun melindungi draf', async ({ page }) => {
  const fixture = await demo(page);
  await fixture.login('/haki/saya?q=Sertifikat');
  await page.getByRole('link', { name: 'Sertifikat uji antarmuka', exact: true }).click();
  const title = page.getByLabel('Judul', { exact: true });
  await title.fill('Draf lokal wajib bertahan');
  const dialog = page.getByRole('dialog', { name: 'Perubahan belum tersimpan' });
  await page.getByLabel('Menu akun').click();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Tetap di halaman' }).click();
  await expect(title).toHaveValue('Draf lokal wajib bertahan');
  await page.evaluate(() => history.back());
  await dialog.getByRole('button', { name: 'Buang perubahan' }).click();
  await expect(page).toHaveURL((url) => url.hash === '#/haki/saya?q=Sertifikat');
  await expect(page.getByRole('searchbox', { name: 'Pencarian', exact: true })).toHaveValue('Sertifikat');
  expect(fixture.versionCalls).toEqual([]);
});

test('simpan hanya membersihkan perubahan yang dikonfirmasi', async ({ page }) => {
  const fixture = await demo(page);
  await fixture.login(documentPath);
  let release = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/rest/v1/rpc/hki_update_fields', async (route) => {
    await pending;
    await route.fallback();
  });
  const title = page.getByLabel('Judul', { exact: true });
  const save = page.getByRole('button', { name: 'Simpan sekarang' });
  await title.fill('Nilai yang sedang dikirim');
  await save.click();
  await expect(page.getByText('Menyimpan...', { exact: true })).toBeVisible();
  await title.fill('Perubahan selama menyimpan');
  release();
  await expect(page.getByRole('heading', { name: 'Nilai yang sedang dikirim', exact: true })).toBeVisible();
  await expect(title).toHaveValue('Perubahan selama menyimpan');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole('heading', { name: 'Perubahan selama menyimpan', exact: true })).toBeVisible();
  expect(fixture.versionCalls).toEqual([1, 2]);
});

test('pilihan tema tersimpan dan teks aksi utama memiliki kontras cukup', async ({ page }) => {
  await (await demo(page)).login('/penelitian');
  const theme = page.getByRole('combobox', { name: 'Tema', exact: true });
  const trigger = page.getByLabel('Menu akun');
  const add = page.getByRole('button', { name: 'Tambah penelitian' });
  await trigger.click();
  for (const value of ['light', 'dark']) {
    await theme.selectOption(value);
    await expect(page.locator('html')).toHaveAttribute('data-theme', value);
    const contrast = await add.evaluate((button) => {
      const style = getComputedStyle(button);
      const luminance = (color: string) => color.match(/\d+(?:\.\d+)?/g)!.slice(0, 3)
        .map((item) => Number(item) / 255)
        .map((item) => item <= 0.04045 ? item / 12.92 : ((item + 0.055) / 1.055) ** 2.4)
        .reduce((sum, item, index) => sum + item * [0.2126, 0.7152, 0.0722][index], 0);
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/?print-test#/haki/portofolio');
  await expect(page.getByRole('heading', { name: 'Portofolio HKI', exact: true })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: 'Portofolio Hak Kekayaan Intelektual' })).toBeVisible();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
});


test('ekspor ZIP meminta filter lebih sempit di atas batas', async ({ page }) => {
  await (await demo(page, 'pemantau', { archiveTotal: 301 })).login('/haki/arsip');
  await page.getByText('Ekspor', { exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'ZIP berkas' })).toBeDisabled();
  await expect(page.getByText('Persempit filter untuk ZIP hingga 300 dokumen.')).toBeVisible();
});
