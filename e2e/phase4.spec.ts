import { expect, test, type Page } from '@playwright/test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';

// Phase 4: background, foreground overlays and lighting (DESIGN.md §6.3–6.5).
// Done when: a character on a blurred forest background with a vignette and
// torchlight from below, and the export matches the preview.

const FLAT = 'e2e/fixtures/flat-goblin.png';
type Rgb = number[];

/** Phone tab for each section. */
const TABS: Record<string, string> = { Image: 'Image', Background: 'Backgr.', Foreground: 'Foregr.', 'Lighting & shadows': 'Lighting' };

/** Opens a section (phone: its tab in the bottom sheet) and returns where its controls are. */
async function section(page: Page, isMobile: boolean, name: string) {
  if (isMobile) {
    await page.getByRole('tab', { name: TABS[name] }).click();
    return page.getByRole('tabpanel');
  }
  const panel = page.getByRole('complementary', { name: 'Token settings' });
  const toggle = panel.getByRole('button', { name, exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return panel;
}

async function exportPixels(page: Page, isMobile: boolean, points: [number, number][]): Promise<Rgb[]> {
  const download = page.waitForEvent('download');
  if (isMobile) await page.locator('.bottom-sheet__summary').getByRole('button', { name: 'Export' }).click();
  else await page.locator('.bottom-bar').getByRole('button', { name: 'Export PNG' }).click();
  const img = await loadImage(readFileSync(await (await download).path()));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return points.map(([fx, fy]) => [...ctx.getImageData(Math.round(fx * img.width), Math.round(fy * img.height), 1, 1).data].slice(0, 3));
}

async function previewPixels(page: Page, points: [number, number][]): Promise<Rgb[]> {
  await page.waitForTimeout(800); // the full-size art arrives from the worker
  return page.getByTestId('token-canvas').evaluate((canvas: HTMLCanvasElement, pts) => {
    const ctx = canvas.getContext('2d')!;
    return pts.map(([fx, fy]) => [...ctx.getImageData(Math.round(fx * canvas.width), Math.round(fy * canvas.height), 1, 1).data].slice(0, 3));
  }, points);
}

const lum = (p: Rgb) => 0.299 * p[0]! + 0.587 * p[1]! + 0.114 * p[2]!;
const near = (a: Rgb, b: Rgb, tolerance: number) => a.every((v, i) => Math.abs(v - b[i]!) <= tolerance);

async function setNumber(scope: ReturnType<Page['locator']>, label: string, value: string) {
  const box = scope.getByRole('textbox', { name: `${label} value`, exact: true });
  await box.fill(value);
  await box.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    return new Promise((r) => {
      const req = indexedDB.deleteDatabase('token-maker');
      req.onsuccess = req.onerror = req.onblocked = () => r(null);
    });
  });
  await page.reload();
  await page.getByTestId('file-input').first().setInputFiles(FLAT);
  await expect(page.locator('.token-summary__name').first()).toHaveText('Flat Goblin');
});

// Spots on the token: forest above the head, the body, the forest beside the body, the edge.
const SKY: [number, number] = [0.5, 0.22];
const BODY: [number, number] = [0.5, 0.72];
const SIDE: [number, number] = [0.27, 0.6];
const EDGE: [number, number] = [0.5, 0.14];

test('a character on a blurred forest with a vignette and torchlight from below; the export matches the preview', async ({ page, isMobile }) => {
  const m = !!isMobile;
  // Cut the character out of its flat background.
  let panel = await section(page, m, 'Image');
  await panel.getByRole('switch', { name: /Remove flat background/ }).click();

  // A blurred forest behind it.
  panel = await section(page, m, 'Background');
  await panel.getByRole('radio', { name: 'Picture' }).click();
  await panel.getByRole('radio', { name: 'Forest' }).click();
  await setNumber(panel, 'Blur', '50');
  const [forest] = await previewPixels(page, [SKY]);
  // The forest is greenish, not the flat background or the dark backing.
  expect(forest![1]!).toBeGreaterThan(forest![2]!);
  expect(lum(forest!)).toBeGreaterThan(30);

  // A vignette.
  panel = await section(page, m, 'Foreground');
  const [edgeBefore] = await previewPixels(page, [EDGE]);
  await panel.getByRole('button', { name: 'Vignette' }).click();
  await expect(panel.getByRole('listitem')).toHaveCount(1);
  const [edgeAfter] = await previewPixels(page, [EDGE]);
  expect(lum(edgeAfter!)).toBeLessThan(lum(edgeBefore!) - 10);

  // Torchlight: from below and warm.
  panel = await section(page, m, 'Lighting & shadows');
  const [bodyBefore] = await previewPixels(page, [BODY]);
  await panel.getByRole('button', { name: /Torchlight/ }).click();
  await expect(panel.getByRole('slider', { name: 'Light comes from' })).toHaveAttribute('aria-valuenow', '90');
  await expect(panel.getByRole('switch', { name: 'Light the art' })).toHaveAttribute('aria-checked', 'true');
  const [bodyAfter, skyLit] = await previewPixels(page, [BODY, SKY]);
  expect(near(bodyAfter!, bodyBefore!, 4)).toBe(false);
  // The forest is lit too: the lower part, nearer the torch, is warmer than the top.
  expect(skyLit![0]! - skyLit![2]!).toBeGreaterThan(forest![0]! - forest![2]!);

  // The export matches the preview.
  const points = [SKY, BODY, SIDE];
  const preview = await previewPixels(page, points);
  const exported = await exportPixels(page, m, points);
  points.forEach((p, i) => expect(near(exported[i]!, preview[i]!, 28), `pixel at ${p}: export ${exported[i]} vs preview ${preview[i]}`).toBe(true));
});

test('overlays can be reordered, hidden and removed; presets stay editable', async ({ page, isMobile }) => {
  const m = !!isMobile;
  let panel = await section(page, m, 'Foreground');
  await panel.getByRole('button', { name: 'Mist' }).click();
  await panel.getByRole('button', { name: 'Smoke' }).click();
  const names = () => panel.locator('.overlay-card__toggle').allTextContents();
  expect(await names()).toEqual(['Smoke', 'Mist']); // newest on top
  await panel.getByRole('button', { name: 'Move Smoke down' }).click();
  expect(await names()).toEqual(['Mist', 'Smoke']);
  await panel.getByRole('button', { name: 'Hide Mist' }).click();
  await expect(panel.getByRole('button', { name: 'Show Mist' })).toBeVisible();
  await panel.getByRole('button', { name: 'Remove Mist' }).click();
  expect(await names()).toEqual(['Smoke']);
  await page.getByRole('button', { name: 'Undo' }).first().click();
  expect(await names()).toEqual(['Mist', 'Smoke']);

  panel = await section(page, m, 'Lighting & shadows');
  await panel.getByRole('button', { name: /Moonlight/ }).click();
  await expect(panel.getByRole('button', { name: /Moonlight/ })).toHaveAttribute('aria-pressed', 'true');
  // Changing a setting by hand keeps the light but it's no longer the preset.
  await setNumber(panel, 'Strength', '30');
  await expect(panel.getByRole('button', { name: /Moonlight/ })).toHaveAttribute('aria-pressed', 'false');
  const dial = panel.getByRole('slider', { name: 'Light comes from' });
  await dial.focus();
  await dial.press('ArrowRight');
  await expect(dial).toHaveAttribute('aria-valuenow', '275');
});

test('your own picture as the background, moved on the canvas', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'canvas drag is covered by the brush tests on phones');
  const panel = await section(page, false, 'Background');
  await panel.getByRole('radio', { name: 'Picture' }).click();
  await panel.getByRole('radio', { name: 'Your own' }).click();
  await page.getByTestId('background-file-input').setInputFiles('e2e/fixtures/goblin-boss.png');
  // The art is unchanged; the background now has a picture of its own.
  await expect(page.locator('.token-summary__name').first()).toHaveText('Flat Goblin');
  await expect(panel.getByRole('button', { name: 'Reset position' })).toBeDisabled();
  await panel.getByRole('button', { name: 'Move on the canvas' }).click();
  const box = (await page.getByTestId('token-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(panel.getByRole('button', { name: 'Reset position' })).toBeEnabled();
  // The art itself didn't move.
  await expect(page.locator('.float-toolbar__readout')).toHaveText('100%');
});
