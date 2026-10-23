import { expect, test, type Page } from '@playwright/test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';

// Phase 3: adjustments, flat background removal and the erase/restore brush
// (DESIGN.md §6.2), on desktop (mouse) and phone (real touch events).
// Background removal is in the Background section since v8.

const FLAT = 'e2e/fixtures/flat-goblin.png';
const BACKING = [0x1d, 0x1f, 0x27];

type Rgb = number[];

async function upload(page: Page) {
  await page.getByTestId('file-input').first().setInputFiles(FLAT);
  await expect(page.locator('.token-summary__name').first()).toHaveText('Flat Goblin');
}

/** The Image section (phone: its tab in the bottom sheet). */
async function imagePanel(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('tab', { name: 'Image' }).click();
    return page.getByRole('tabpanel');
  }
  const panel = page.getByRole('complementary', { name: 'Token settings' });
  const toggle = panel.getByRole('button', { name: 'Image', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return panel;
}

/** Background removal, in the Background section since v8 (phone: its tab). */
async function removeBackground(page: Page, isMobile: boolean) {
  let panel;
  if (isMobile) {
    await page.getByRole('tab', { name: 'Backgr.' }).click();
    panel = page.getByRole('tabpanel');
  } else {
    panel = page.getByRole('complementary', { name: 'Token settings' });
    const toggle = panel.getByRole('button', { name: 'Background', exact: true });
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  }
  await panel.getByRole('switch', { name: 'Remove background' }).click();
  return panel;
}

/** Downloads the PNG and reads pixels at fractions of its size. */
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

/** Pixels of the live preview canvas, at the same fractions. */
async function previewPixels(page: Page, points: [number, number][]): Promise<Rgb[]> {
  await page.waitForTimeout(600); // the full-size art arrives from the worker
  return page.getByTestId('token-canvas').evaluate((canvas: HTMLCanvasElement, pts) => {
    const ctx = canvas.getContext('2d')!;
    return pts.map(([fx, fy]) => [...ctx.getImageData(Math.round(fx * canvas.width), Math.round(fy * canvas.height), 1, 1).data].slice(0, 3));
  }, points);
}

const near = (a: Rgb, b: Rgb, tolerance = 6) => a.every((v, i) => Math.abs(v - b[i]!) <= tolerance);

/** A horizontal stroke across the token at height `fy`, with the mouse or a finger. */
async function stroke(page: Page, isMobile: boolean, fy: number) {
  const box = (await page.getByTestId('token-canvas').boundingBox())!;
  const y = box.y + box.height * fy;
  const from = { x: box.x + box.width * 0.3, y };
  const to = { x: box.x + box.width * 0.7, y };
  if (!isMobile) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 12, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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
});

// Spots on the token: background above the head, the body, and a line through the face.
const BG: [number, number] = [0.5, 0.2];
const BODY: [number, number] = [0.5, 0.7];
const FACE: [number, number] = [0.5, 0.4];

test('remove a flat background, tidy it with the brush, tune it, and the export matches the preview', async ({ page, isMobile }) => {
  await upload(page);
  const [bgBefore] = await exportPixels(page, !!isMobile, [BG]);
  expect(near(bgBefore!, [0xfb, 0xfb, 0xf8])).toBe(true); // the white background

  // Remove the background: the backing colour shows instead of white.
  const bgPanel = await removeBackground(page, !!isMobile);
  await expect(bgPanel.getByText('Found from the edges')).toBeVisible();
  const panel = await imagePanel(page, !!isMobile);
  const [bgAfter, faceBefore] = await exportPixels(page, !!isMobile, [BG, FACE]);
  expect(near(bgAfter!, BACKING)).toBe(true);
  expect(near(faceBefore!, BACKING)).toBe(false);

  // Erase a line through the face with the brush.
  await panel.getByRole('button', { name: 'Use the brush' }).click();
  await expect(page.getByRole('toolbar', { name: 'Brush' })).toBeVisible();
  await stroke(page, !!isMobile, FACE[1]);
  const [faceErased] = await exportPixels(page, !!isMobile, [FACE]);
  expect(near(faceErased!, BACKING)).toBe(true);

  // One stroke is one undo step.
  await page.getByRole('button', { name: 'Undo' }).first().click();
  const [faceBack] = await exportPixels(page, !!isMobile, [FACE]);
  expect(near(faceBack!, faceBefore!)).toBe(true);
  await page.getByRole('toolbar', { name: 'Brush' }).getByRole('button', { name: 'Done' }).click();

  // Tune: brighter body.
  const [bodyBefore] = await exportPixels(page, !!isMobile, [BODY]);
  const brightness = panel.getByRole('textbox', { name: 'Brightness value' });
  await brightness.fill('40');
  await brightness.press('Enter');
  const [bodyAfter, bgFinal] = await exportPixels(page, !!isMobile, [BODY, BG]);
  expect(bodyAfter![0]!).toBeGreaterThan(bodyBefore![0]! + 20);

  // The preview shows exactly what was exported.
  const [bodyPreview, bgPreview] = await previewPixels(page, [BODY, BG]);
  expect(near(bodyPreview!, bodyAfter!)).toBe(true);
  expect(near(bgPreview!, bgFinal!)).toBe(true);
});

test('restore brings back part of the removed background', async ({ page, isMobile }) => {
  await upload(page);
  await removeBackground(page, !!isMobile);
  const panel = await imagePanel(page, !!isMobile);
  await panel.getByRole('button', { name: 'Use the brush' }).click();
  await page.getByRole('toolbar', { name: 'Brush' }).getByRole('button', { name: 'Restore' }).click();
  await stroke(page, !!isMobile, BG[1]);
  const [bg] = await exportPixels(page, !!isMobile, [BG]);
  expect(near(bg!, [0xfb, 0xfb, 0xf8])).toBe(true);
});

test('the eyedropper picks the background colour from the picture', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'covered by the desktop and tablet runs');
  await upload(page);
  const panel = await removeBackground(page, false);
  await panel.getByRole('button', { name: 'Pick colour' }).click();
  const box = (await page.getByTestId('token-canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.65); // the red body
  await expect(panel.getByText('Picked')).toBeVisible();
  await expect(panel.locator('.bg-colour code')).toHaveText('#7a2e2e');
  await panel.getByRole('button', { name: 'Auto' }).click();
  await expect(panel.getByText('Found from the edges')).toBeVisible();
});
