import { expect, test, type Page } from '@playwright/test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';

// Phase 8: the label (DESIGN.md §6.10).
// Done when: add a ribbon label in a fantasy font, or curve the name around
// the ring, and the export matches.

const GOBLIN = 'e2e/fixtures/goblin-boss.png';
// Any font file will do for "upload your own"; this one is OFL, from the bundled set.
const OWN_FONT = 'node_modules/@fontsource/eagle-lake/files/eagle-lake-latin-400-normal.woff2';

async function section(page: Page, isMobile: boolean, name: string) {
  if (isMobile) {
    await page.getByRole('tab', { name }).click();
    const panel = page.getByRole('tabpanel');
    const toggle = panel.getByRole('button', { name, exact: true });
    if ((await toggle.count()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    return panel;
  }
  const panel = page.getByRole('complementary', { name: 'Token settings' });
  const toggle = panel.getByRole('button', { name, exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return panel;
}

async function exportPng(page: Page, isMobile: boolean): Promise<Buffer> {
  const download = page.waitForEvent('download');
  if (isMobile) await page.locator('.bottom-sheet__summary').getByRole('button', { name: 'Export' }).click();
  else await page.locator('.bottom-bar').getByRole('button', { name: 'Export PNG' }).click();
  return readFileSync(await (await download).path());
}

const pixels = async (src: Buffer, size = 128) => {
  const img = await loadImage(src);
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
};

/** The preview and an exported PNG, both shrunk to 64 px: the average difference per channel. */
async function previewVsExport(page: Page, isMobile: boolean): Promise<number> {
  await page.waitForTimeout(800);
  const previewUrl = await page.getByTestId('token-canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png'));
  const a = await pixels(Buffer.from(previewUrl.split(',')[1]!, 'base64'), 64);
  const b = await pixels(await exportPng(page, isMobile), 64);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / a.length;
}

/** How many pixels differ clearly between two exports (128 px copies). */
async function changedPixels(a: Buffer, b: Buffer): Promise<number> {
  const x = await pixels(a);
  const y = await pixels(b);
  let n = 0;
  for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i]! - y[i]!) + Math.abs(x[i + 1]! - y[i + 1]!) + Math.abs(x[i + 2]! - y[i + 2]!) > 60) n++;
  return n;
}

async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    return Promise.all(
      ['token-maker', 'token-maker-fonts'].map(
        (name) =>
          new Promise((r) => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = req.onerror = req.onblocked = () => r(null);
          }),
      ),
    );
  });
  await page.reload();
  await page.getByTestId('file-input').first().setInputFiles(GOBLIN);
  await expect(page.locator('.token-summary__name').first()).toHaveText('Goblin Boss');
}

test('a ribbon label in a fantasy font, then the name curved round the ring; the export matches', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  const m = !!isMobile;
  await fresh(page);
  const before = await exportPng(page, m);

  // A banner with the token's name, in Pirata One.
  let panel = await section(page, m, 'Label');
  await panel.getByRole('button', { name: 'Add a label' }).click();
  await expect(panel.getByRole('radio', { name: 'Banner' })).toHaveAttribute('aria-checked', 'true');
  const fonts = panel.getByRole('radiogroup', { name: 'Font' });
  await fonts.getByRole('radio', { name: 'Pirata One' }).click();
  await expect(fonts.getByRole('radio', { name: 'Pirata One' })).toHaveAttribute('aria-checked', 'true');
  // The picker shows each name in its own font, from the site's own files.
  await expect(fonts.getByRole('radio', { name: 'Pirata One' })).toHaveCSS('font-family', /tm-pirata-one/);
  expect(await previewVsExport(page, m)).toBeLessThan(6);
  const pirata = await exportPng(page, m);
  expect(await page.evaluate(() => document.fonts.check('20px "tm-pirata-one"'))).toBe(true);
  expect(await changedPixels(before, pirata)).toBeGreaterThan(300);

  // Another font changes the letters in the export.
  await fonts.getByRole('radio', { name: 'UnifrakturMaguntia' }).click();
  await page.waitForTimeout(300);
  const fraktur = await exportPng(page, m);
  expect(await changedPixels(pirata, fraktur)).toBeGreaterThan(40);

  // Curved round the ring.
  panel = await section(page, m, 'Label');
  await panel.getByRole('radio', { name: 'Ring text' }).click();
  await expect(panel.getByRole('radio', { name: 'Ring text' })).toHaveAttribute('aria-checked', 'true');
  expect(await previewVsExport(page, m)).toBeLessThan(6);
  const ring = await exportPng(page, m);
  expect(await changedPixels(fraktur, ring)).toBeGreaterThan(200);

  // A long name shrinks to fit.
  await panel.getByLabel('Text', { exact: true }).fill('Grimbold the Unbearably Long-Winded, Lord of the Deep Halls');
  await panel.getByLabel('Text', { exact: true }).blur();
  expect(await previewVsExport(page, m)).toBeLessThan(6);

  // It all survives a reload (autosave), still in the right font.
  await page.reload();
  await expect(page.locator('.token-summary__name').first()).toHaveText('Goblin Boss');
  panel = await section(page, m, 'Label');
  await expect(panel.getByRole('radio', { name: 'Ring text' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByRole('radiogroup', { name: 'Font' }).getByRole('radio', { name: 'UnifrakturMaguntia' })).toHaveAttribute('aria-checked', 'true');
  expect(await previewVsExport(page, m)).toBeLessThan(6);
});

test('drag the label on the canvas: it snaps to the top or bottom', async ({ page, isMobile }) => {
  const m = !!isMobile;
  await fresh(page);
  const panel = await section(page, m, 'Label');
  await panel.getByRole('button', { name: 'Add a label' }).click();
  const place = panel.getByRole('radiogroup', { name: 'Position' });
  // Start at the top: on phones the bottom sheet covers the lower part of the token.
  await place.getByRole('radio', { name: 'Top' }).click();
  await expect(place.getByRole('radio', { name: 'Top' })).toHaveAttribute('aria-checked', 'true');

  // Grab the middle of the banner and drop it near the bottom of the frame.
  const box = (await page.getByTestId('token-canvas').boundingBox())!;
  const from = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.15 };
  const to = { x: from.x, y: from.y + box.height * 0.68 };
  if (m) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', p: { x: number; y: number }[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p.map((q) => ({ x: q.x, y: q.y })) });
    await touch('touchStart', [from]);
    for (let i = 1; i <= 12; i++) await touch('touchMove', [{ x: from.x, y: from.y + ((to.y - from.y) * i) / 12 }]);
    await touch('touchEnd', []);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  }
  const label = await section(page, m, 'Label');
  await expect(label.getByRole('radiogroup', { name: 'Position' }).getByRole('radio', { name: 'Bottom' })).toHaveAttribute('aria-checked', 'true');
  // The art didn't move: the drag went to the label, and the export still matches.
  expect(await previewVsExport(page, m)).toBeLessThan(6);
});

test('upload your own font; it is kept in this browser', async ({ page, isMobile }) => {
  const m = !!isMobile;
  await fresh(page);
  let panel = await section(page, m, 'Label');
  await panel.getByRole('button', { name: 'Add a label' }).click();
  await panel.getByTestId('font-file-input').setInputFiles(OWN_FONT);
  const own = panel.getByRole('radiogroup', { name: 'Font' }).getByRole('radio', { name: 'eagle lake latin 400 normal' });
  await expect(own).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByText('Your fonts')).toBeVisible();
  expect(await previewVsExport(page, m)).toBeLessThan(6);

  // A file that isn't a font is refused with a friendly message.
  await panel.getByTestId('font-file-input').setInputFiles({ name: 'notes.ttf', mimeType: 'font/ttf', buffer: Buffer.from('not a font at all') });
  await expect(page.getByText(/couldn't be used as a font/)).toBeVisible();

  await page.reload();
  panel = await section(page, m, 'Label');
  await expect(panel.getByRole('radiogroup', { name: 'Font' }).getByRole('radio', { name: 'eagle lake latin 400 normal' })).toHaveAttribute('aria-checked', 'true');
  expect(await previewVsExport(page, m)).toBeLessThan(6);
});
