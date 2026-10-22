import { expect, test, type Page } from '@playwright/test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';

// Phase 5: pop-out art and shadows (DESIGN.md §6.6, §6.7).
// Done when: part of the creature breaks over the border with a matching
// shadow, and stays on the creature when the art moves.

const FLAT = 'e2e/fixtures/flat-goblin.png';
type Rgb = number[];

/** Phone tab for each section. */
const TABS: Record<string, string> = { Image: 'Image', 'Pop-out': 'Image', 'Lighting & shadows': 'Lighting' };

async function section(page: Page, isMobile: boolean, name: string) {
  if (isMobile) {
    await page.getByRole('tab', { name: TABS[name] }).click();
    const panel = page.getByRole('tabpanel');
    // Sections sharing a tab open one at a time.
    const toggle = panel.getByRole('button', { name, exact: true });
    if ((await toggle.count()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    return panel;
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

const near = (a: Rgb, b: Rgb, tolerance: number) => a.every((v, i) => Math.abs(v - b[i]!) <= tolerance);

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
  await page.getByTestId('file-input').first().setInputFiles(FLAT);
  await expect(page.locator('.token-summary__name').first()).toHaveText('Flat Goblin');
});

// The goblin's red body runs down under the bottom of the frame.
const RED = [0x7a, 0x2e, 0x2e];
const ON_FRAME: [number, number] = [0.5, 0.925];
const INSIDE: [number, number] = [0.5, 0.75];

test('paint part of the art over the frame; it moves with the art, and the export matches the preview', async ({ page, isMobile }) => {
  const m = !!isMobile;
  let panel = await section(page, m, 'Image');
  await panel.getByRole('switch', { name: 'Remove flat background' }).click();

  const [frameBefore] = await exportPixels(page, m, [ON_FRAME]);
  expect(near(frameBefore!, RED, 40)).toBe(false); // the frame covers the body there

  // Paint the bottom of the body so it breaks over the frame.
  panel = await section(page, m, 'Pop-out');
  const size = panel.getByRole('textbox', { name: 'Pop-out brush size value' });
  await size.fill('90');
  await size.press('Enter');
  await panel.getByRole('button', { name: 'Paint pop-out' }).click();
  const toolbar = page.getByRole('toolbar', { name: 'Pop-out brush' });
  await expect(toolbar).toBeVisible();
  await stroke(page, m, ON_FRAME[1]);
  await toolbar.getByRole('button', { name: 'Done' }).click();

  const preview = await previewPixels(page, [ON_FRAME, INSIDE]);
  const exported = await exportPixels(page, m, [ON_FRAME, INSIDE]);
  expect(near(exported[0]!, RED, 40), `on the frame: ${exported[0]}`).toBe(true);
  expect(near(exported[1]!, RED, 40)).toBe(true);
  // The preview shows what was exported (the frame is solid again after Done).
  expect(near(preview[0]!, exported[0]!, 28)).toBe(true);

  // Move the art up: the painted part goes with the body, so the frame shows again.
  await page.locator('.stage').focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowUp');
  const [frameAfterMove] = await exportPixels(page, m, [ON_FRAME]);
  expect(near(frameAfterMove!, RED, 40), `after the move: ${frameAfterMove}`).toBe(false);

  // Undo the moves: it pops out again.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Undo' }).first().click();
  const [frameBack] = await exportPixels(page, m, [ON_FRAME]);
  expect(near(frameBack!, RED, 40)).toBe(true);

  // Switching the pop-out off puts it back behind the frame without losing it.
  panel = await section(page, m, 'Pop-out');
  await panel.getByRole('switch', { name: 'Pop-out on' }).click();
  const [frameOff] = await exportPixels(page, m, [ON_FRAME]);
  expect(near(frameOff!, RED, 40)).toBe(false);
  await expect(panel.getByRole('button', { name: 'Clear pop-out' })).toBeEnabled();
});

test('shadows follow the light until unlinked', async ({ page, isMobile }) => {
  const m = !!isMobile;
  const panel = await section(page, m, 'Lighting & shadows');
  const follow = panel.getByRole('switch', { name: 'Drop shadow: follow the light' });
  await expect(follow).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByRole('slider', { name: 'Drop shadow direction' })).toHaveCount(0);

  const alphaAt = async (points: [number, number][]) => {
    const download = page.waitForEvent('download');
    if (m) await page.locator('.bottom-sheet__summary').getByRole('button', { name: 'Export' }).click();
    else await page.locator('.bottom-bar').getByRole('button', { name: 'Export PNG' }).click();
    const img = await loadImage(readFileSync(await (await download).path()));
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return points.map(([fx, fy]) => ctx.getImageData(Math.round(fx * img.width), Math.round(fy * img.height), 1, 1).data[3]!);
  };
  // Light from the top left: the shadow falls down and right. Just outside the circle on the diagonal:
  // the bottom right is in shadow, the top left isn't.
  const OUT_BR: [number, number] = [0.825, 0.825];
  const OUT_TL: [number, number] = [0.175, 0.175];
  const [a1, b1] = await alphaAt([OUT_BR, OUT_TL]);
  expect(a1!).toBeGreaterThan(b1! + 20);

  // Unlink and point the shadow up and left instead.
  await follow.click();
  const dial = panel.getByRole('slider', { name: 'Drop shadow direction' });
  await expect(dial).toHaveAttribute('aria-valuenow', '45'); // starts where it was
  await dial.focus();
  for (let i = 0; i < 12; i++) await dial.press('Shift+ArrowRight'); // 45° → 225°
  const [a2, b2] = await alphaAt([OUT_BR, OUT_TL]);
  expect(b2!).toBeGreaterThan(a2! + 20);

  // The inner shadow can be switched off.
  await panel.getByRole('switch', { name: 'Inner shadow' }).click();
  await expect(panel.getByRole('textbox', { name: 'Inner shadow strength value' })).toHaveCount(0);
});
