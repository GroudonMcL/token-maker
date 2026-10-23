import { expect, test, type Page } from '@playwright/test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';

// Phase 9: export and batch mode (DESIGN.md §6.11, §6.1).
// Done when: drop in six goblin images, style one, see all six share the
// look, nudge each one's crop, and download a ZIP of six named tokens.

const GOBLIN = readFileSync('e2e/fixtures/goblin-boss.png');
const FLAT = readFileSync('e2e/fixtures/flat-goblin.png');
const SIX = ['goblin-archer', 'goblin-shaman', 'goblin-brute', 'goblin-scout', 'goblin-sneak', 'goblin-chief'].map((name, i) => ({
  name: `${name}.png`,
  mimeType: 'image/png',
  buffer: i % 2 ? FLAT : GOBLIN,
}));

async function section(page: Page, isMobile: boolean, name: string, tab = name) {
  if (isMobile) {
    await page.getByRole('tab', { name: tab }).click();
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

/** Clicks something and returns the downloaded file's name and bytes. */
async function download(page: Page, click: () => Promise<void>) {
  const wait = page.waitForEvent('download');
  await click();
  const d = await wait;
  return { name: d.suggestedFilename(), bytes: readFileSync(await d.path()) };
}

const pixels = async (src: Buffer | Uint8Array, size = 64) => {
  const img = await loadImage(Buffer.from(src));
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  return { data: ctx.getImageData(0, 0, size, size).data, width: img.width, height: img.height };
};

/** Average difference per channel between two pictures, both shrunk to 64 px. */
async function difference(a: Buffer | Uint8Array, b: Buffer | Uint8Array): Promise<number> {
  const x = (await pixels(a)).data;
  const y = (await pixels(b)).data;
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i]! - y[i]!);
  return sum / x.length;
}

async function previewPng(page: Page): Promise<Buffer> {
  await page.waitForTimeout(800);
  const url = await page.getByTestId('token-canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png'));
  return Buffer.from(url.split(',')[1]!, 'base64');
}

async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    return new Promise((r) => {
      const req = indexedDB.deleteDatabase('token-maker');
      req.onsuccess = req.onerror = req.onblocked = () => r(null);
    });
  });
  await page.reload();
}

const strip = (page: Page) => page.getByRole('radiogroup', { name: 'Tokens in the batch' });

test('six goblins share one style, each keeps its own crop, and download as a ZIP of six named tokens', async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  const m = !!isMobile;
  await fresh(page);
  await page.getByRole('switch', { name: 'Batch' }).click();

  // Six pictures at once.
  await page.getByTestId('file-input').first().setInputFiles(SIX);
  await expect(strip(page).getByRole('radio')).toHaveCount(6);
  await expect(page.locator('.token-summary__name').first()).toHaveText('Goblin Archer');

  // Style the one on screen: a square token. Every token takes the look.
  const frame = await section(page, m, 'Frame & shape', 'Frame');
  await frame.getByRole('radio', { name: 'Square' }).click();

  // Nudge each one's crop: turn the shaman upside down and the brute a quarter turn.
  await strip(page).getByRole('radio', { name: 'Goblin Shaman' }).click();
  await expect(page.locator('.token-summary__name').first()).toHaveText('Goblin Shaman');
  await page.getByRole('toolbar', { name: 'Image tools' }).getByRole('button', { name: 'Flip upside down' }).click();
  await strip(page).getByRole('radio', { name: 'Goblin Brute' }).click();
  await page.getByRole('toolbar', { name: 'Image tools' }).getByRole('button', { name: 'Rotate' }).click();
  await strip(page).getByRole('radio', { name: 'Goblin Archer' }).click();
  await expect(page.getByRole('radio', { name: 'Goblin Archer' })).toHaveAttribute('aria-checked', 'true');

  // Rename the scout from the Import section.
  await strip(page).getByRole('radio', { name: 'Goblin Scout' }).click();
  const imp = await section(page, m, 'Import');
  await imp.getByLabel('Token name').fill('Scout Captain');
  await imp.getByLabel('Token name').blur();
  const scoutPreview = await previewPng(page);

  // Export all.
  const exportAll = m
    ? page.locator('.bottom-sheet__summary').getByRole('button', { name: 'Export all (6)' })
    : page.locator('.bottom-bar').getByRole('button', { name: 'Export all (6)' });
  const zipFile = await download(page, () => exportAll.click());
  expect(zipFile.name).toBe('tokens.zip');
  const files = unzipSync(new Uint8Array(zipFile.bytes));
  expect(Object.keys(files)).toEqual(['Goblin-Archer.png', 'Goblin-Shaman.png', 'Goblin-Brute.png', 'Scout-Captain.png', 'Goblin-Sneak.png', 'Goblin-Chief.png']);

  for (const [name, bytes] of Object.entries(files)) {
    const p = await pixels(bytes);
    expect([p.width, p.height], name).toEqual([256, 256]);
    // Square tokens: a corner just inside the frame is solid in every one.
    expect(p.data[(4 * 64 + 4) * 4 + 3], name).toBeGreaterThan(200);
  }
  // Same picture, same style: the archer and the brute differ only by the brute's turn; the shaman (flat goblin) is upside down compared with the scout's picture.
  expect(await difference(files['Goblin-Archer.png']!, files['Goblin-Brute.png']!)).toBeGreaterThan(3);
  expect(await difference(files['Goblin-Shaman.png']!, files['Scout-Captain.png']!)).toBeGreaterThan(3);
  expect(await difference(files['Scout-Captain.png']!, files['Goblin-Chief.png']!)).toBeLessThan(0.5);
  // The token on screen is exported exactly as previewed.
  expect(await difference(files['Scout-Captain.png']!, scoutPreview)).toBeLessThan(6);

  // The batch survives a reload.
  await page.reload();
  await expect(strip(page).getByRole('radio')).toHaveCount(6);
  await expect(strip(page).getByRole('radio', { name: 'Scout Captain' })).toHaveAttribute('aria-checked', 'true');
});

test('every format and resolution matches the preview, with a safe file name', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  const m = !!isMobile;
  await fresh(page);
  await page.getByTestId('file-input').first().setInputFiles({ name: 'goblin boss!.png', mimeType: 'image/png', buffer: GOBLIN });
  await expect(page.locator('.token-summary__name').first()).toHaveText('Goblin Boss!');
  const preview = await previewPng(page);

  const panel = await section(page, m, 'Export');
  const sizes = { '128': 128, '256': 256, '512': 512 } as const;
  for (const [format, ext] of [
    ['PNG', 'png'],
    ['WebP', 'webp'],
    ['JPG', 'jpg'],
  ] as const) {
    await panel.getByRole('radio', { name: format, exact: true }).click();
    for (const [label, side] of Object.entries(sizes)) {
      await panel.getByRole('radio', { name: label, exact: true }).click();
      const file = await download(page, () => panel.getByRole('button', { name: `Download ${format}` }).click());
      expect(file.name).toBe(`Goblin-Boss.${ext}`);
      const p = await pixels(file.bytes);
      expect([p.width, p.height]).toEqual([side, side]);
      if (format === 'JPG') {
        // White fill in the see-through corners (the default fill colour).
        expect([...p.data.slice(0, 3)].every((v) => v > 240)).toBe(true);
      } else {
        expect(p.data[3]).toBe(0);
        expect(await difference(file.bytes, preview)).toBeLessThan(format === 'PNG' ? 4 : 6);
      }
    }
  }

  // A custom size shows the final size, never more than 4096 px.
  await panel.getByRole('radio', { name: 'Custom' }).click();
  await panel.getByLabel('Custom pixels per square value').fill('5000');
  await panel.getByLabel('Custom pixels per square value').press('Enter');
  await expect(panel.getByTestId('export-size')).toContainText('4096 × 4096 px');

  // An edited file name is used.
  await panel.getByRole('radio', { name: '128', exact: true }).click();
  await panel.getByRole('radio', { name: 'PNG', exact: true }).click();
  await panel.getByLabel('File name').fill('my boss/token');
  const named = await download(page, () => panel.getByRole('button', { name: 'Download PNG' }).click());
  expect(named.name).toBe('my-bosstoken.png');
});

test('copy to clipboard puts the PNG on the clipboard', async ({ page, isMobile, browserName, context }) => {
  test.skip(browserName !== 'chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fresh(page);
  await page.getByTestId('file-input').first().setInputFiles('e2e/fixtures/goblin-boss.png');
  const panel = await section(page, !!isMobile, 'Export');
  await panel.getByRole('button', { name: 'Copy to clipboard' }).click();
  await expect(page.getByText('Copied the token')).toBeVisible();
  const types = await page.evaluate(async () => (await navigator.clipboard.read())[0]?.types ?? []);
  expect(types).toContain('image/png');
});
