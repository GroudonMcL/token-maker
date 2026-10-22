import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Web imports (DESIGN.md §6.1 items 2–5). The /api answers are faked in the
// browser so these tests never touch the real internet; the proxy itself is
// covered by the unit tests in server/.

const PNG = readFileSync('e2e/fixtures/goblin-boss.png');

type PageAnswer = Record<string, unknown> | { status: number; error: string };

async function fakeApi(page: Page, answers: { images?: Record<string, number>; pages?: Record<string, PageAnswer> }) {
  await page.route('**/api/fetch-image?*', (route) => {
    const target = new URL(route.request().url()).searchParams.get('url')!;
    const status = answers.images?.[target] ?? 404;
    if (status === 200) return route.fulfill({ status, contentType: 'image/png', body: PNG });
    return route.fulfill({ status: 502, json: { error: { code: 'not_found', message: '' } } });
  });
  await page.route('**/api/page-images?*', (route) => {
    const target = new URL(route.request().url()).searchParams.get('url')!;
    const answer = answers.pages?.[target];
    if (!answer) return route.fulfill({ status: 502, json: { error: { code: 'network', message: '' } } });
    if ('error' in answer) return route.fulfill({ status: answer.status as number, json: { error: { code: answer.error, message: '' } } });
    return route.fulfill({ json: answer });
  });
  // Thumbnails load straight from the "site".
  await page.route('https://cdn.example/**', (route) => route.fulfill({ contentType: 'image/png', body: PNG }));
}

/** The Import section (phone: its tab in the bottom sheet). */
async function importPanel(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('tab', { name: 'Import' }).click();
    return page.getByRole('tabpanel');
  }
  return page.getByRole('complementary', { name: 'Token settings' });
}

async function getAddress(page: Page, isMobile: boolean, address: string) {
  const panel = await importPanel(page, isMobile);
  await panel.getByRole('textbox', { name: 'Web address' }).fill(address);
  await panel.getByRole('button', { name: 'Get' }).click();
  return panel;
}

const tokenName = (page: Page) => page.locator('.token-summary__name').first();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => new Promise((r) => {
    const req = indexedDB.deleteDatabase('token-maker');
    req.onsuccess = req.onerror = req.onblocked = () => r(null);
  }));
  await page.reload();
});

test('a direct image link loads straight away', async ({ page, isMobile }) => {
  await fakeApi(page, { images: { 'https://cdn.example/art/cave-troll-1024x1024.png': 200 } });
  await getAddress(page, !!isMobile, 'cdn.example/art/cave-troll-1024x1024.png');
  await expect(tokenName(page)).toHaveText('Cave Troll');
  await expect(page.getByTestId('token-canvas')).toBeVisible();
});

test('a page link shows its pictures and loads the one picked', async ({ page, isMobile }) => {
  await fakeApi(page, {
    pages: {
      'https://blog.example/goblins': {
        kind: 'page',
        url: 'https://blog.example/goblins',
        title: 'Goblins | Fantasy Blog',
        images: [
          { url: 'https://cdn.example/goblin-archer.png', alt: 'Goblin archer' },
          { url: 'https://cdn.example/hobgoblin-captain.png', alt: 'Hobgoblin captain' },
          { url: 'https://cdn.example/bugbear.png', alt: 'Bugbear' },
        ],
      },
    },
    images: { 'https://cdn.example/hobgoblin-captain.png': 200 },
  });
  const panel = await getAddress(page, !!isMobile, 'https://blog.example/goblins');
  const strip = panel.getByRole('radiogroup', { name: 'Pictures on blog.example' });
  await expect(strip.getByRole('radio')).toHaveCount(3);
  await strip.getByRole('radio', { name: 'Hobgoblin captain' }).click();
  await expect(tokenName(page)).toHaveText('Hobgoblin Captain');
  await expect(strip.getByRole('radio', { name: 'Hobgoblin captain' })).toHaveAttribute('aria-checked', 'true');
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(strip).toHaveCount(0);
});

test('a pasted Pinterest short link loads the pin, falling back from the original', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'desktop paste');
  await fakeApi(page, {
    pages: {
      'https://pin.it/4x2Yj8Yd': {
        kind: 'pinterest',
        url: 'https://www.pinterest.com/pin/571112796472578260/',
        title: 'Goblin Token',
        images: [{ url: 'https://i.pinimg.com/originals/bb/2b/70/bb.png' }, { url: 'https://i.pinimg.com/736x/bb/2b/70/bb.jpg' }],
      },
    },
    images: { 'https://i.pinimg.com/736x/bb/2b/70/bb.jpg': 200 },
  });
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'https://pin.it/4x2Yj8Yd');
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(tokenName(page)).toHaveText('Goblin Token');
});

test('an image dragged from another tab goes through the same path', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'desktop drag');
  await fakeApi(page, { images: { 'https://cdn.example/owlbear.png': 200 } });
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/uri-list', 'https://site.example/gallery/owlbear');
    dt.setData('text/html', '<a href="https://site.example/gallery/owlbear"><img src="https://cdn.example/owlbear.png"></a>');
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(tokenName(page)).toHaveText('Owlbear');
});

test('a site that blocks fetching gets a friendly message', async ({ page, isMobile }) => {
  await fakeApi(page, { pages: { 'https://strict.example/art': { status: 502, error: 'site_refused' } } });
  const panel = await getAddress(page, !!isMobile, 'https://strict.example/art');
  await expect(panel.getByRole('alert')).toContainText('Copy image address');
});
