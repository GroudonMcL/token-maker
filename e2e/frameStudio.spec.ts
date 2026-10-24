import { expect, test, type Page } from '@playwright/test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';

// Frame Studio designs as frames (DESIGN.md §6.12): a .framestudio.json file
// saved in Frame Studio opens as the token's frame, follows the token's band,
// survives a reload and is exported like any other frame.

const JEWELLED = 'e2e/fixtures/designs/jewelled.framestudio.json';
const NIGHT_SKY = 'e2e/fixtures/designs/night-sky.framestudio.json';
const GOBLIN = 'e2e/fixtures/goblin-boss.png';

async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    return Promise.all(
      ['token-maker', 'token-maker-frames', 'token-maker-presets', 'token-maker-designs'].map(
        (name) =>
          new Promise((r) => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = req.onerror = req.onblocked = () => r(null);
          }),
      ),
    );
  });
  await page.reload();
}

async function framePanel(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('tab', { name: 'Frame' }).click();
    const panel = page.getByRole('tabpanel');
    const toggle = panel.getByRole('button', { name: 'Frame & shape', exact: true });
    if ((await toggle.count()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    return panel;
  }
  const panel = page.getByRole('complementary', { name: 'Token settings' });
  const toggle = panel.getByRole('button', { name: 'Frame & shape', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return panel;
}

/** The exported PNG's pixel at fractions of its width and height. */
async function exportPixel(page: Page, isMobile: boolean, fx: number, fy: number): Promise<number[]> {
  const download = page.waitForEvent('download');
  if (isMobile) await page.locator('.bottom-sheet__summary').getByRole('button', { name: 'Export' }).click();
  else await page.locator('.bottom-bar').getByRole('button', { name: 'Export PNG' }).click();
  const img = await loadImage(readFileSync(await (await download).path()));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return [...ctx.getImageData(Math.round(fx * img.width), Math.round(fy * img.height), 1, 1).data];
}

test('open a Frame Studio design as the frame, change the band, reload and export', async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  const m = !!isMobile;
  await fresh(page);
  await page.getByTestId('file-input').first().setInputFiles(GOBLIN);
  await expect(page.locator('.bottom-bar, .bottom-sheet__summary').getByRole('button', { name: /^Export/ }).first()).toBeEnabled();
  let panel = await framePanel(page, m);
  await panel.getByRole('radio', { name: 'Frame Studio' }).click();
  await expect(panel.getByText(/No designs yet/)).toBeVisible();
  await panel.getByTestId('design-file-input').setInputFiles(JEWELLED);
  await expect(panel.getByRole('radio', { name: 'Jewelled' })).toHaveAttribute('aria-checked', 'true');
  await panel.getByTestId('design-file-input').setInputFiles(NIGHT_SKY);
  await expect(panel.getByRole('radio', { name: 'Night sky' })).toHaveAttribute('aria-checked', 'true');
  await panel.getByRole('radio', { name: 'Jewelled' }).click();
  await expect(panel.getByRole('radio', { name: 'Jewelled' })).toHaveAttribute('aria-checked', 'true');

  // The design's band: the top of the frame is painted (Jewelled's silver band).
  const top = await exportPixel(page, m, 0.5, 0.15);
  expect(top[3]).toBe(255);

  // A thicker band: the design follows it (the band now reaches further in, over the art).
  panel = await framePanel(page, m);
  const inside = await exportPixel(page, m, 0.5, 0.17);
  const thickness = panel.getByRole('slider', { name: /Thickness/ });
  await thickness.focus();
  for (let i = 0; i < 14; i++) await thickness.press('ArrowRight');
  const after = await exportPixel(page, m, 0.5, 0.17);
  expect(after).not.toEqual(inside);

  // The design is part of the token: it survives a reload, and the designs stay in this browser.
  await page.waitForTimeout(800);
  await page.reload();
  panel = await framePanel(page, m);
  await expect(panel.getByRole('radio', { name: 'Frame Studio' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByRole('radio', { name: 'Jewelled' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByRole('radio', { name: 'Night sky' })).toBeVisible();
  expect(await exportPixel(page, m, 0.5, 0.17)).toEqual(after);
});

test('a file that is not a design is refused with a message', async ({ page, isMobile }) => {
  await fresh(page);
  const panel = await framePanel(page, !!isMobile);
  await panel.getByRole('radio', { name: 'Frame Studio' }).click();
  await panel.getByTestId('design-file-input').setInputFiles({ name: 'oops.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": 1}') });
  await expect(page.getByText(/isn't a Frame Studio design/)).toBeVisible();
});
