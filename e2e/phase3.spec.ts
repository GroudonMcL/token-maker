// Phase 3: image adjustments, background removal and the erase/restore brush,
// on desktop, tablet and phone. "Done when": remove a flat background, tidy it
// with the brush, tune the image, and the export matches the preview.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const KNIGHT = 'e2e/fixtures/flat-knight.png';
type Rgba = [number, number, number, number];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    () =>
      new Promise((r) => {
        const req = indexedDB.deleteDatabase('token-maker');
        req.onsuccess = req.onerror = req.onblocked = () => r(null);
      }),
  );
  await page.reload();
  await page.getByTestId('file-input').first().setInputFiles(KNIGHT);
  await expect(page.locator('.token-summary__name').first()).toHaveText('Flat Knight');
});

/** The Image section's controls (phone: the Image tab of the bottom sheet). */
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

/** Downloads the PNG and returns a pixel reader for it (x, y as fractions of the size). */
async function exportPixels(page: Page, isMobile: boolean) {
  const download = page.waitForEvent('download');
  if (isMobile) await page.locator('.bottom-sheet__summary').getByRole('button', { name: 'Export' }).click();
  else await page.locator('.bottom-bar').getByRole('button', { name: 'Export PNG' }).click();
  const img = await loadImage(readFileSync(await (await download).path()));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return (fx: number, fy: number): Rgba => Array.from(ctx.getImageData(Math.round(fx * img.width), Math.round(fy * img.height), 1, 1).data) as Rgba;
}

/** The on-screen preview's pixel at (fx, fy) of the token. */
function previewPixel(page: Page, fx: number, fy: number): Promise<Rgba> {
  return page.getByTestId('token-canvas').evaluate((c: HTMLCanvasElement, [fx, fy]) => {
    const d = c.getContext('2d')!.getImageData(Math.round(fx! * c.width), Math.round(fy! * c.height), 1, 1).data;
    return [d[0]!, d[1]!, d[2]!, d[3]!] as [number, number, number, number];
  }, [fx, fy]);
}

const near = (a: Rgba, b: Rgba, tol = 24) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);
const isWhite = (p: Rgba) => p[0] > 230 && p[1] > 230 && p[2] > 230;

/** Drags across the token from (fx0, fy0) to (fx1, fy1), with a finger on touch screens. */
async function drag(page: Page, isMobile: boolean, from: [number, number], to: [number, number]) {
  const box = (await page.getByTestId('token-canvas').boundingBox())!;
  const at = ([fx, fy]: [number, number]) => ({ x: box.x + fx * box.width, y: box.y + fy * box.height });
  const a = at(from);
  const b = at(to);
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  }
}

/** On phones the sheet covers the canvas, so lower it before working on the token. */
async function lowerSheet(page: Page, isMobile: boolean) {
  if (!isMobile) return;
  const handle = page.getByRole('button', { name: /settings panel/ });
  if ((await handle.getAttribute('aria-expanded')) === 'true') await handle.click();
}

// Inside the frame, above the knight's helmet: white background in the picture.
const SKY: [number, number] = [0.5, 0.16];

test('remove the background, tidy it with the brush, tune the image; the export matches the preview', async ({ page, isMobile }) => {
  const m = !!isMobile;
  let panel = await imagePanel(page, m);
  expect(isWhite((await exportPixels(page, m))(...SKY))).toBe(true);

  // Remove the flat white background: the dark backing shows through instead.
  await panel.getByRole('switch', { name: 'Remove background' }).click();
  await expect.poll(async () => isWhite(await previewPixel(page, ...SKY))).toBe(false);
  const removed = await exportPixels(page, m);
  expect(removed(...SKY)[0]).toBeLessThan(60);
  expect(isWhite(removed(0.5, 0.33))).toBe(true); // the enclosed white visor is kept

  // Restore a band of the background with the brush (one undo step), then undo it.
  panel = await imagePanel(page, m);
  await panel.getByRole('button', { name: 'Restore', exact: true }).click();
  await lowerSheet(page, m);
  await drag(page, m, [0.3, 0.16], [0.7, 0.16]);
  await expect.poll(async () => isWhite(await previewPixel(page, ...SKY))).toBe(true);
  await page.getByRole('button', { name: 'Done' }).click();
  expect(isWhite((await exportPixels(page, m))(...SKY))).toBe(true);
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expect.poll(async () => isWhite(await previewPixel(page, ...SKY))).toBe(false);

  // Erase part of the knight's body.
  panel = await imagePanel(page, m);
  await panel.getByRole('button', { name: 'Erase', exact: true }).click();
  await lowerSheet(page, m);
  const body: [number, number] = [0.5, 0.7];
  const before = await previewPixel(page, ...body);
  await drag(page, m, [0.42, 0.7], [0.58, 0.7]);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => near(await previewPixel(page, ...body), before)).toBe(false);

  // Tune the image: type a brightness.
  panel = await imagePanel(page, m);
  const helmet: [number, number] = [0.5, 0.26];
  const dim = await previewPixel(page, ...helmet);
  const box = panel.getByRole('textbox', { name: 'Brightness value' });
  await box.fill('-40');
  await box.press('Enter');
  await expect.poll(async () => (await previewPixel(page, ...helmet))[0]).toBeLessThan(dim[0] - 30);

  // The export matches the preview.
  const out = await exportPixels(page, m);
  for (const p of [SKY, body, helmet, [0.3, 0.6], [0.45, 0.6]] as [number, number][]) {
    expect(near(out(...p), await previewPixel(page, ...p)), `pixel at ${p}`).toBe(true);
  }
});

test('the eyedropper picks the background colour and Advanced holds the extra sliders', async ({ page, isMobile }) => {
  const m = !!isMobile;
  const panel = await imagePanel(page, m);
  await panel.getByRole('switch', { name: 'Remove background' }).click();
  await panel.getByRole('button', { name: 'Pick' }).click();
  await lowerSheet(page, m);
  const box = (await page.getByTestId('token-canvas').boundingBox())!;
  // Click inside the helmet's white visor: it is removed too, being enclosed by the helmet.
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.33);
  await expect.poll(async () => isWhite(await previewPixel(page, 0.5, 0.33))).toBe(false);
  const again = await imagePanel(page, m);
  await expect(again.getByText(/Picked/)).toBeVisible();

  await again.getByRole('button', { name: 'Advanced' }).click();
  for (const name of ['Hue', 'Temperature', 'Tint', 'Exposure', 'Highlights', 'Shadows', 'Sharpness', 'Blur', 'Vibrance', 'Grayscale', 'Sepia']) {
    await expect(again.getByRole('slider', { name })).toBeAttached();
  }
  await expect(again.getByRole('switch', { name: 'Invert' })).toBeAttached();
});
