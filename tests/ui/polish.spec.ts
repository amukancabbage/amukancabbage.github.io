import { expect, test } from '@playwright/test';
import { demo, documentId, documentPath, researchTitle, secondDocumentId } from './fixtures';

test('form masuk tetap bisa dipakai di lima lebar dan dua tema', async ({ page }) => {
  await page.goto('/#/beranda');
  const show = page.getByRole('button', { name: 'Tampilkan kata sandi' });
  const password = page.getByLabel('Kata sandi', { exact: true });
  await expect(page.getByRole('heading', { name: 'Masuk', exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const { fits, contrast } = await page.evaluate(() => {
        const card = document.querySelector('.login-card')!;
        function luminance(color: string) {
          return color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => value / 255)
            .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
            .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        }
        return {
          fits: document.documentElement.scrollWidth <= innerWidth,
          contrast: [...card.querySelectorAll('h1, label, button')].map((element) => {
            const style = getComputedStyle(element);
            const foreground = luminance(style.color);
            const background = luminance(style.backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(card).backgroundColor : style.backgroundColor);
            return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
          }),
        };
      });
      expect(fits).toBe(true);
      expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
    }
  }
  await show.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Sembunyikan kata sandi' }).press('Space');
  await expect(password).toHaveAttribute('type', 'password');
});

test('tabel utama muat di desktop dan editor mengembalikan fokus', async ({ page }) => {
  await (await demo(page, 'dosen', { academicTotal: 11 })).login('/penelitian?q=Penelitian&page=2');
  const table = page.getByRole('table', { name: 'Penelitian', exact: true });
  const edit = table.getByRole('button', { name: 'Ubah', exact: true });
  await expect(table.getByText(researchTitle)).toBeVisible();
  await expect(table.getByRole('columnheader')).toHaveCount(5);

  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(edit).toBeInViewport({ ratio: 1 });
    expect(await table.evaluate((element) => {
      const wrapper = element.parentElement!;
      const action = element.querySelector('td.actions button')!.getBoundingClientRect();
      return wrapper.scrollWidth <= wrapper.clientWidth && action.right <= wrapper.getBoundingClientRect().right;
    })).toBe(true);
  }

  await table.getByText('Rincian', { exact: true }).press('Enter');
  await expect(table.getByText('Rp4.000.000', { exact: true })).toBeVisible();
  await expect(table.getByRole('button', { name: 'Hapus' })).toBeVisible();
  await edit.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Ubah penelitian' });
  await dialog.getByLabel('Judul Penelitian').fill('Penelitian Uji diperbarui');
  await dialog.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(table.getByText('Penelitian Uji diperbarui')).toBeVisible();
  await expect(edit).toBeFocused();
  await expect(page).toHaveURL((url) => url.hash === '#/penelitian?q=Penelitian&page=2');
  await expect(page.getByLabel('Pencarian')).toHaveValue('Penelitian');

  await page.setViewportSize({ width: 320, height: 844 });
  const card = page.getByRole('article').filter({ hasText: 'Penelitian Uji diperbarui' });
  await expect(card.getByText('Dosen Uji', { exact: true })).toBeVisible();
  await expect(card.getByText('2025', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Hapus' })).toHaveCount(0);
});

test('antrean ponsel membuka pilihan massal saat diminta dan menampilkan hasil RPC', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await demo(page, 'validator', { secondQueueRow: true });
  await fixture.login('/haki/antrean?unit=1');
  const first = page.getByRole('link', { name: 'Sertifikat uji antarmuka', exact: true });
  await expect(first).toBeVisible();
  expect((await first.boundingBox())?.y).toBeLessThan(360);
  await expect(page.getByText('Filter lainnya (1)', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const mode = page.getByRole('button', { name: 'Pilih dokumen', exact: true });
  await mode.press('Enter');
  const all = page.getByRole('checkbox', { name: 'Pilih semua di halaman ini' });
  await all.check();
  await expect(page.getByRole('button', { name: 'Setujui terpilih (2)' })).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Pilih Sertifikat kedua' }).uncheck();
  const submit = page.getByRole('button', { name: 'Setujui terpilih (1)' });
  await submit.press('Enter');
  const confirm = page.getByRole('dialog', { name: 'Setujui dokumen terpilih' });
  await expect(confirm.getByRole('button', { name: 'Batal' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(submit).toBeFocused();
  await submit.press('Enter');
  await confirm.getByRole('button', { name: 'Setujui dokumen', exact: true }).click();
  await expect(page.getByText('0 disetujui. 1 dilewati.')).toBeVisible();
  await expect(page.getByText('Sertifikat uji antarmuka · ada field berkeyakinan rendah')).toBeVisible();
  await expect(mode).toHaveAttribute('aria-expanded', 'false');
  expect(fixture.bulkCalls).toEqual([[documentId]]);
  await first.click();
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await expect(page).toHaveURL((url) => url.hash === '#/haki/dokumen/' + secondDocumentId);
  await page.getByRole('link', { name: '‹ Antrean' }).click();
  await expect(page).toHaveURL((url) => url.hash === '#/haki/antrean?unit=1');
});

test('unggah atas nama menampilkan hasil campuran dan melanjutkan berkas gagal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await demo(page, 'operator', { failSecondUpload: true });
  await fixture.login('/haki/unggah');
  await expect(page.getByRole('button', { name: 'Pilih berkas', exact: true })).toHaveCount(0);
  await page.getByLabel('Atas nama dosen').selectOption('71');
  const png = await page.evaluate(() => document.createElement('canvas').toDataURL('image/png').split(',')[1]);
  await page.locator('input[type=file][multiple]').setInputFiles(['sertifikat-a.png', 'sertifikat-b.png'].map((name) => ({
    name, mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  })));
  await expect(page.getByText('2 berkas siap diunggah atas nama Dosen Uji.')).toBeVisible();
  await page.getByRole('button', { name: 'Unggah 2 berkas' }).click();
  await expect(page.getByText('1 tersimpan · 1 gagal')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buka dokumen' })).toHaveCount(1);
  const failed = page.getByRole('listitem').filter({ hasText: 'sertifikat-b.png' });
  await expect(failed).toContainText('Penyimpanan sementara gagal');
  await page.getByLabel('Atas nama dosen').selectOption('72');
  await failed.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.getByText('2 tersimpan · 0 gagal')).toBeVisible();
  await expect(failed).toContainText('Dosen Uji');
  await expect(failed.getByRole('link', { name: 'Buka dokumen' })).toHaveAttribute('href', '#/haki/dokumen/' + secondDocumentId);
  expect(fixture.uploadOwners).toEqual([71, 71]);
  expect(fixture.registrations).toEqual([documentId, secondDocumentId]);
  expect(fixture.storageWrites.filter((path) => path.includes(secondDocumentId) && !path.endsWith('.prep.json'))).toHaveLength(2);
});

test('simpan metadata tetap terlihat saat menggulir dan pratinjau berpindah pada 1.200 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await demo(page);
  await fixture.login(documentPath);
  const title = page.getByLabel('Judul', { exact: true });
  await title.fill('Draf masih bisa disimpan saat menggulir');
  const save = page.getByRole('button', { name: 'Simpan sekarang' });
  const lateField = page.getByLabel('Berlaku Sampai');
  await lateField.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await expect(save).toBeInViewport({ ratio: 1 });
  await expect(save).toBeEnabled();
  await expect(page.getByText('Simpan atau batalkan perubahan metadata sebelum melanjutkan.')).toHaveCount(1);
  await save.click();
  await expect(page.getByRole('heading', { name: 'Draf masih bisa disimpan saat menggulir', exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1199, height: 900 });
  await expect(page.getByRole('tab', { name: 'Berkas' })).toBeVisible();
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.getByRole('tab', { name: 'Berkas' })).toHaveCount(0);
  await lateField.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await expect(save).toBeInViewport({ ratio: 1 });
  const topbar = (await page.getByRole('banner').boundingBox())!;
  const preview = (await page.getByRole('button', { name: 'Unggah berkas utama' }).boundingBox())!;
  expect(preview.y).toBeGreaterThanOrEqual(topbar.y + topbar.height);

  await page.clock.install();
  await title.fill('Draf tersimpan otomatis');
  await expect(page.getByText('1 perubahan belum tersimpan', { exact: true })).toBeVisible();
  await page.clock.fastForward(9_000);
  expect(fixture.versionCalls).toEqual([1]);
  await page.clock.fastForward(1_000);
  await expect(page.getByRole('heading', { name: 'Draf tersimpan otomatis', exact: true })).toBeVisible();
  expect(fixture.versionCalls).toEqual([1, 2]);
});
