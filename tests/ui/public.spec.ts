import { expect, test } from '@playwright/test';
import { demo, documentPath } from './fixtures';

test('landing publik menampilkan layanan di lima lebar dan dua tema', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('SISIDOS | Sistem Informasi Dosen');
  await expect(page.getByRole('heading', { name: 'Sistem Informasi Dosen', level: 1 })).toBeVisible();
  const services = page.getByRole('region', { name: 'Layanan SISIDOS' });
  await expect(services.getByRole('listitem')).toHaveCount(3);

  const action = page.getByRole('link', { name: 'Masuk ke SISIDOS' });
  const photo = page.locator('.landing-image');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect.poll(() => photo.evaluate((img) => (
        img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
      ))).toBe(true);
      const bounds = await action.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
    }
  }

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Masuk', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(action).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL((url) => url.hash === '#/masuk');
  await expect(page.getByRole('heading', { name: 'Bantuan akun' })).toBeVisible();
  await page.getByRole('link', { name: 'Halaman depan' }).click();
  await expect(page.getByRole('heading', { name: 'Sistem Informasi Dosen', level: 1 })).toBeVisible();
});

test('masuk dari landing menampilkan kesalahan akun dan membuka beranda setelah berhasil', async ({ page }) => {
  await demo(page);
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST' || request.postDataJSON().password === 'test-password') {
      return route.fallback();
    }
    return route.fulfill({
      status: 400,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'x-supabase-api-version',
        'x-supabase-api-version': '2024-01-01',
      },
      json: { code: 'invalid_credentials', msg: 'Invalid login credentials' },
    });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Masuk ke SISIDOS' }).click();
  await expect(page).toHaveTitle('Masuk | SISIDOS');
  const email = page.getByLabel('Email', { exact: true });
  const password = page.getByLabel('Kata sandi', { exact: true });
  await email.fill('dosen@example.test');
  await password.fill('kata-sandi-salah');
  await password.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Email atau kata sandi salah.');
  await expect(email).toHaveValue('dosen@example.test');
  await expect(page).toHaveURL((url) => url.hash === '#/masuk');

  await password.fill('test-password');
  await password.press('Enter');
  await expect(page).toHaveURL((url) => url.hash === '#/beranda');
  await expect(page.getByRole('heading', { name: 'Beranda', exact: true })).toBeVisible();
  await page.goBack();
  const openHome = page.getByRole('main').getByRole('link', { name: 'Buka beranda' });
  await expect(openHome).toBeVisible();
  await openHome.click();
  await expect(page).toHaveURL((url) => url.hash === '#/beranda');
});

test('tautan langsung HKI membawa pengguna ke dokumen yang sama setelah masuk', async ({ page }) => {
  const fixture = await demo(page);
  const target = documentPath + '?from=notification';
  await fixture.login(target);
  await expect(page).toHaveURL((url) => url.hash === '#' + target);
  await expect(page.getByRole('heading', { name: 'Sertifikat uji antarmuka' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL((url) => url.hash === '#' + target);
  await expect(page.getByRole('heading', { name: 'Sertifikat uji antarmuka' })).toBeVisible();
});
