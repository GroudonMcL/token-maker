import { expect, test, type Page } from '@playwright/test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';

// Phase 6: styles and effects (DESIGN.md §6.8).
// Done when: stack a frost glow on the border, mist over the art and a
// "bloodied" look, reorder them, and export.

const FLAT = 'e2e/fixtures/flat-goblin.png';
type Rgba = number[];

async function effectsPanel(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('tab', { name: 'Effects' }).click();
    return page.getByRole('tabpanel');
  }
  const panel = page.getByRole('complementary', { name: 'Token settings' });
  const toggle = panel.getByRole('button', { name: 'Effects', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return panel;
}

async function exportPixels(page: Page, isMobile: boolean, points: [number, number][]): Promise<Rgba[]> {
  const download = page.waitForEvent('download');
  if (isMobile) await page.locator('.bottom-sheet__summary').getByRole('button', { name: 'Export' }).click();
  else await page.locator('.bottom-bar').getByRole('button', { name: 'Export PNG' }).click();
  const img = await loadImage(readFileSync(await (await download).path()));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return points.map(([fx, fy]) => [...ctx.getImageData(Math.round(fx * img.width), Math.round(fy * img.height), 1, 1).data]);
}

/** The preview and an exported PNG, both shrunk to 64 px: the average difference per channel. */
async function previewVsExport(page: Page, isMobile: boolean): Promise<number> {
  await page.waitForTimeout(800);
  const previewUrl = await page.getByTestId('token-canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png'));
  const download = page.waitForEvent('download');
  if (isMobile) await page.locator('.bottom-sheet__summary').getByRole('button', { name: 'Export' }).click();
  else await page.locator('.bottom-bar').getByRole('button', { name: 'Export PNG' }).click();
  const shrink = async (src: Buffer) => {
    const img = await loadImage(src);
    const c = createCanvas(64, 64);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 64, 64);
    return ctx.getImageData(0, 0, 64, 64).data;
  };
  const a = await shrink(Buffer.from(previewUrl.split(',')[1]!, 'base64'));
  const b = await shrink(readFileSync(await (await download).path()));
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / a.length;
}

const differs = (a: Rgba, b: Rgba, by: number) => a.reduce((s, v, i) => s + Math.abs(v - b[i]!), 0) > by;

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

// Around the frame (frost), low inside the opening (mist), and the list order.
const OUTSIDE: [number, number] = [0.5, 0.025];
const FRAME: [number, number] = [0.5, 0.07];
const LOW: [number, number] = [0.5, 0.8]; // the goblin's red body
const MIDDLE: [number, number] = [0.5, 0.45];
const POINTS = [OUTSIDE, FRAME, LOW, MIDDLE];

test('stack a frost border, mist over the art and a bloodied look, reorder them and export', async ({ page, isMobile }) => {
  const m = !!isMobile;
  const before = await exportPixels(page, m, POINTS);
  const panel = await effectsPanel(page, m);

  // The picker shows a live thumbnail for every drawn effect (and picture effects show their pictures).
  await expect(panel.locator('.tile[data-effect] img')).toHaveCount(24);
  await expect(panel.locator('.tile[data-effect-picture] img')).toHaveCount(12);

  await panel.getByRole('button', { name: /^Frost$/ }).click();
  await panel.getByRole('button', { name: /^Mist$/ }).click();
  await panel.getByRole('button', { name: /^Bloodied$/ }).click();
  const list = panel.getByRole('list', { name: 'Effects, top first' });
  const order = () => list.getByRole('listitem').evaluateAll((items) => items.map((i) => i.getAttribute('data-effect')));
  expect(await order()).toEqual(['bloodied', 'mist', 'frost']);
  await expect(list.getByRole('listitem').first()).toContainText('over art');
  await expect(list.getByRole('listitem').last()).toContainText('on border');

  // Reorder: mist goes to the top, frost one up.
  await list.getByRole('button', { name: 'Move Mist up' }).click();
  await list.getByRole('button', { name: 'Move Frost up' }).click();
  expect(await order()).toEqual(['mist', 'frost', 'bloodied']);

  const after = await exportPixels(page, m, POINTS);
  // Frost glows round the border, where there was only the drop shadow before.
  expect(differs(after[0]!, before[0]!, 40), `outside: ${before[0]} → ${after[0]}`).toBe(true);
  expect(differs(after[1]!, before[1]!, 40), `frame: ${before[1]} → ${after[1]}`).toBe(true);
  // Mist lightens the bottom of the art.
  const lum = (p: Rgba) => p[0]! * 0.3 + p[1]! * 0.59 + p[2]! * 0.11;
  expect(lum(after[2]!)).toBeGreaterThan(lum(before[2]!) + 15);
  // The export matches the preview.
  expect(await previewVsExport(page, m)).toBeLessThan(6);

  // The stack survives a reload (autosave).
  await page.waitForTimeout(1200);
  await page.reload();
  const again = await effectsPanel(page, m);
  await expect(again.getByRole('list', { name: 'Effects, top first' }).getByRole('listitem')).toHaveCount(3);
});

test('changing placement, colour and intensity', async ({ page, isMobile }) => {
  const m = !!isMobile;
  const panel = await effectsPanel(page, m);
  await panel.getByRole('button', { name: /^Outer glow$/ }).click();
  const [onBorder] = await exportPixels(page, m, [OUTSIDE]);
  expect(onBorder![3]).toBeGreaterThan(50);

  // Behind the art the glow hugs the art, not the token's edge.
  await panel.getByRole('radio', { name: 'Behind art' }).click();
  const [behind] = await exportPixels(page, m, [OUTSIDE]);
  expect(behind![3]).toBeLessThan(onBorder![3]! - 30);

  await panel.getByRole('radio', { name: 'On border' }).click();
  const intensity = panel.getByRole('textbox', { name: 'Intensity value' });
  await intensity.fill('0');
  await intensity.press('Enter');
  const [off] = await exportPixels(page, m, [OUTSIDE]);
  expect(off![3]).toBeLessThan(onBorder![3]! - 30);
});

test('three stacked effects stay smooth while a slider moves', async ({ page, isMobile }) => {
  const panel = await effectsPanel(page, !!isMobile);
  for (const name of ['Frost', 'Mist', 'Bloodied']) await panel.getByRole('button', { name: new RegExp(`^${name}$`) }).click();
  const slider = panel.getByRole('slider', { name: 'Intensity' });
  await slider.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  // Count how long frames take while the slider moves.
  await page.evaluate(() => {
    const w = window as unknown as { __gaps: number[]; __stop: boolean };
    w.__gaps = [];
    w.__stop = false;
    let last = performance.now();
    const tick = (t: number) => {
      w.__gaps.push(t - last);
      last = t;
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // Move it 30 steps; every step redraws the token with all three effects.
  await slider.focus();
  for (let i = 0; i < 30; i++) await slider.press('ArrowLeft');
  const gaps = await page.evaluate(() => {
    const w = window as unknown as { __gaps: number[]; __stop: boolean };
    w.__stop = true;
    return w.__gaps.slice(1);
  });
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  expect(gaps.length).toBeGreaterThan(5);
  expect(median, `frame times: ${gaps.map((g) => g.toFixed(0)).join(' ')}`).toBeLessThan(40);
  expect(Number(await slider.inputValue())).toBe(55); // Bloodied starts at 85
});
