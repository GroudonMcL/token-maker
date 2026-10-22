import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const FIXTURE = 'e2e/fixtures/goblin-boss.png';

/** Width and height from a PNG file's header. */
function pngSize(buf: Buffer) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function upload(page: Page) {
  await page.getByTestId('file-input').first().setInputFiles(FIXTURE);
  await expect(page.locator('.token-summary__name').first()).toHaveText('Goblin Boss');
}

async function exportPng(page: Page, isMobile: boolean) {
  const download = page.waitForEvent('download');
  if (isMobile) await page.locator('.bottom-sheet__summary').getByRole('button', { name: 'Export' }).click();
  else await page.locator('.bottom-bar').getByRole('button', { name: 'Export PNG' }).click();
  const file = await download;
  const path = await file.path();
  return { name: file.suggestedFilename(), size: pngSize(readFileSync(path)) };
}

/** Opens the panel holding a section (phone: its tab in the bottom sheet). */
async function openSection(page: Page, isMobile: boolean, section: string, tab: string) {
  if (isMobile) {
    await page.getByRole('tab', { name: tab }).click();
    return page.getByRole('tabpanel');
  }
  const panel = page.getByRole('complementary', { name: 'Token settings' });
  const toggle = panel.getByRole('button', { name: section, exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return panel;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Start clean: clear any autosave left by an earlier test.
  await page.evaluate(() => new Promise((r) => {
    const req = indexedDB.deleteDatabase('token-maker');
    req.onsuccess = req.onerror = req.onblocked = () => r(null);
  }));
  await page.reload();
});

test('import an image and download a 256 px PNG', async ({ page, isMobile }) => {
  await upload(page);
  await expect(page.getByTestId('token-canvas')).toBeVisible();
  const out = await exportPng(page, !!isMobile);
  expect(out.name).toBe('Goblin-Boss.png');
  expect(out.size).toEqual({ width: 256, height: 256 });
});

test('Large tokens export at 512 px with the size shown', async ({ page, isMobile }) => {
  await upload(page);
  const panel = await openSection(page, !!isMobile, 'Size', 'Frame');
  await panel.getByRole('radio', { name: 'Large' }).click();
  await expect(page.getByTestId('pixel-size').first()).toHaveText('512 × 512 px');
  const out = await exportPng(page, !!isMobile);
  expect(out.size).toEqual({ width: 512, height: 512 });
});

test('pick a frame and undo it', async ({ page, isMobile }) => {
  await upload(page);
  const panel = await openSection(page, !!isMobile, 'Frame & shape', 'Frame');
  await panel.getByRole('radio', { name: 'Oak' }).click();
  await expect(panel.getByRole('radio', { name: 'Oak' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expect(panel.getByRole('radio', { name: 'Stamped' })).toHaveAttribute('aria-checked', 'true');
});

test('drag the art, then use the scale and rotate handles', async ({ page }) => {
  await upload(page);
  const canvas = page.getByTestId('token-canvas');
  const box = (await canvas.boundingBox())!;
  const readout = page.locator('.float-toolbar__readout');
  const before = await readout.textContent();

  // Scale handle: drag the bottom-right corner outwards.
  const handle = page.getByTestId('scale-handle-2');
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 60, h.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(readout).not.toHaveText(before!);

  // One drag = one undo step.
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expect(readout).toHaveText(before!);

  // Rotate handle, then move the art by dragging it.
  const rot = (await page.getByTestId('rotate-handle').boundingBox())!;
  await page.mouse.move(rot.x + rot.width / 2, rot.y + rot.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 40, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo' }).first()).toBeEnabled();
});

test('drop and paste import images', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'desktop gestures');
  const b64 = readFileSync(FIXTURE).toString('base64');
  for (const kind of ['drop', 'paste'] as const) {
    await page.evaluate(
      async ({ b64, kind }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const file = new File([bytes], kind === 'drop' ? 'cave-troll.png' : 'image.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);
        if (kind === 'drop') window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        else document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      },
      { b64, kind },
    );
    // A dropped file names the token; a pasted "image.png" keeps the current name.
    await expect(page.locator('.token-summary__name')).toHaveText('Cave Troll');
  }
});

test('the token survives a page reload (autosave)', async ({ page, isMobile }) => {
  await upload(page);
  const panel = await openSection(page, !!isMobile, 'Frame & shape', 'Frame');
  await panel.getByRole('radio', { name: 'Hexagon' }).click();
  await page.waitForTimeout(800); // autosave runs shortly after changes
  await page.reload();
  await expect(page.locator('.token-summary__name').first()).toHaveText('Goblin Boss');
  const panel2 = await openSection(page, !!isMobile, 'Frame & shape', 'Frame');
  await expect(panel2.getByRole('radio', { name: 'Hexagon' })).toHaveAttribute('aria-checked', 'true');
});
