import { expect, test, type Browser, type Page } from '@playwright/test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';

// Phase 7: picture frames, decorations and presets (DESIGN.md §6.9).
// Done when: upload my own ring PNG, add mirrored horns, save the look as a
// preset, export the preset file and load it back in another browser.

const GOBLIN = 'e2e/fixtures/goblin-boss.png';
const RING = 'e2e/fixtures/purple-ring.png';
type Rgba = number[];

/** Phone tab for each section. */
const TABS: Record<string, string> = { 'Frame & shape': 'Frame', Presets: 'Frame', Decorations: 'Decor' };

async function section(page: Page, isMobile: boolean, name: string) {
  if (isMobile) {
    await page.getByRole('tab', { name: TABS[name] }).click();
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

async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    return Promise.all(
      ['token-maker', 'token-maker-frames', 'token-maker-presets'].map(
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

// The purple ring's band (left of the middle, between two studs), the horns
// (beyond the ring at the top corners) and the art in the middle.
const BAND: [number, number] = [0.5 + Math.cos((195 * Math.PI) / 180) * 0.42, 0.5 + Math.sin((195 * Math.PI) / 180) * 0.42];
const HORN_RIGHT: [number, number] = [0.86, 0.13];
const HORN_LEFT: [number, number] = [0.14, 0.13];
const MIDDLE: [number, number] = [0.5, 0.5];
const POINTS = [BAND, HORN_RIGHT, HORN_LEFT, MIDDLE];
const isPurple = ([r, g, b]: Rgba) => b! > 140 && r! > 80 && g! < 110;

/** Checks a token has the purple ring and both horns. */
async function expectRingAndHorns(page: Page, isMobile: boolean) {
  const [band, right, left, middle] = await exportPixels(page, isMobile, POINTS);
  expect(isPurple(band!), `band ${band}`).toBe(true);
  expect(right![3], `right horn ${right}`).toBeGreaterThan(200);
  expect(left![3], `left horn ${left}`).toBeGreaterThan(200);
  expect(middle![3]).toBe(255);
}

async function anotherBrowser(browser: Browser, isMobile: boolean, contextOptions: Parameters<Browser['newContext']>[0]) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await fresh(page);
  // Nothing from the first browser is here.
  const presets = await section(page, isMobile, 'Presets');
  await expect(presets.getByText('Nothing saved yet.')).toBeVisible();
  return { context, page };
}

test('upload a ring PNG, add mirrored horns, save a preset, export it and load it in another browser', async ({ page, isMobile, browser, contextOptions }) => {
  test.setTimeout(90_000);
  const m = !!isMobile;
  await fresh(page);

  // 1. My own ring PNG as a picture frame: the hole is found automatically.
  let panel = await section(page, m, 'Frame & shape');
  await panel.getByRole('radio', { name: 'Picture' }).click();
  await panel.getByTestId('frame-file-input').setInputFiles(RING);
  await expect(panel.getByRole('radio', { name: 'Purple Ring' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByText('Your frames')).toBeVisible();

  // 2. Mirrored horns: one decoration, drawn on both sides.
  panel = await section(page, m, 'Decorations');
  await panel.getByRole('button', { name: /^Horn$/ }).click();
  await expect(panel.getByRole('list', { name: 'Decorations, top first' }).getByRole('listitem')).toHaveText(/Horn\s*top right, mirrored/);
  await expectRingAndHorns(page, m);
  expect(await previewVsExport(page, m)).toBeLessThan(6);

  // 3. Save the look as a preset, and download it as a file.
  panel = await section(page, m, 'Presets');
  await panel.getByLabel('Save this look').fill('Purple horns');
  await panel.getByRole('button', { name: 'Save', exact: true }).click();
  const yours = panel.getByRole('list', { name: 'Your presets' });
  await expect(yours.getByRole('button', { name: 'Purple horns', exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await yours.getByRole('button', { name: 'Download Purple horns as a file' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('purple-horns.tokenpreset.json');
  const presetPath = await file.path();
  const saved = JSON.parse(readFileSync(presetPath, 'utf8'));
  expect(saved.look.decorations[0].kind).toBe('horn');
  expect(JSON.stringify(saved)).not.toContain('asset:'); // never the art
  // …and as a text code.
  await yours.getByRole('button', { name: 'Copy the code for Purple horns' }).click();
  const code = await panel.getByTestId('preset-code').inputValue();
  expect(code).toMatch(/^TKP1\./);

  // 4. Another browser (a fresh profile): load the file.
  const other = await anotherBrowser(browser, m, contextOptions);
  let p2 = await section(other.page, m, 'Presets');
  await p2.getByTestId('preset-file-input').setInputFiles(presetPath);
  await expect(p2.getByRole('list', { name: 'Your presets' }).getByRole('button', { name: 'Purple horns', exact: true })).toBeVisible();
  await expectRingAndHorns(other.page, m);
  // The ring came along and is now one of this browser's frames too.
  p2 = await section(other.page, m, 'Frame & shape');
  await expect(p2.getByRole('radio', { name: 'Purple Ring' })).toHaveAttribute('aria-checked', 'true');
  await other.context.close();

  // 5. And a third browser: paste the code.
  const third = await anotherBrowser(browser, m, contextOptions);
  const p3 = await section(third.page, m, 'Presets');
  await p3.getByPlaceholder(/Paste a preset code/).fill(code);
  await p3.getByRole('button', { name: 'Add the code' }).click();
  await expect(p3.getByRole('list', { name: 'Your presets' }).getByRole('button', { name: 'Purple horns', exact: true })).toBeVisible();
  await expectRingAndHorns(third.page, m);
  await third.context.close();
});

test('built-in picture frame and preset; drag a decoration on the canvas to another snap point', async ({ page, isMobile }) => {
  const m = !!isMobile;
  await fresh(page);
  let panel = await section(page, m, 'Presets');
  await panel.getByRole('button', { name: /^Celestial$/ }).click();
  panel = await section(page, m, 'Decorations');
  const list = panel.getByRole('list', { name: 'Decorations, top first' });
  await expect(list.getByRole('listitem')).toHaveCount(2);

  // The holy symbol sits at the top of the frame; drag it to the bottom.
  const box = (await page.getByTestId('token-canvas').boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height * 0.085 };
  const to = { x: box.x + box.width / 2, y: box.y + box.height * 0.915 };
  if (m) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', p: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p.map((q) => ({ x: q.x, y: q.y })) });
    await touch('touchStart', [from]);
    for (let i = 1; i <= 10; i++) await touch('touchMove', [{ x: from.x, y: from.y + ((to.y - from.y) * i) / 10 }]);
    await touch('touchEnd', []);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  }
  panel = await section(page, m, 'Decorations');
  await expect(panel.getByRole('list', { name: 'Decorations, top first' }).getByRole('listitem').first()).toHaveText(/Holy symbol\s*bottom/);
  // The tapped decoration is selected: its card is open and it has handles.
  await expect(page.getByTestId('decor-rotate-handle')).toBeVisible();

  // A built-in picture frame.
  panel = await section(page, m, 'Frame & shape');
  await panel.getByRole('radio', { name: 'Picture' }).click();
  await panel.getByRole('radio', { name: 'Runestone' }).click();
  await expect(panel.getByRole('radio', { name: 'Runestone' })).toHaveAttribute('aria-checked', 'true');
  expect(await previewVsExport(page, m)).toBeLessThan(6);
});
