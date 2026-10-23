import { expect, test, type Page } from '@playwright/test';

// Owner feedback after Phase 10 (document v8): menu styles, slider resets,
// the resizable panel, the two-way theme, picture effects and decorations,
// plain and turned labels, the new creature sizes, and a clear message when
// the image server is missing.

async function sample(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Try a sample/ }).click();
  await expect(page.locator('.token-summary__name').first()).toHaveText('Goblin');
}

/** Opens a section (phone: its tab) and returns where its controls are. */
async function section(page: Page, isMobile: boolean, name: string, tab = name) {
  if (isMobile) {
    await page.getByRole('tab', { name: tab }).click();
    return page.getByRole('tabpanel');
  }
  const panel = page.getByRole('complementary', { name: 'Token settings' });
  const toggle = panel.getByRole('button', { name, exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return panel;
}

test('menu style hides, folds or shows the Advanced settings, and is remembered', async ({ page, isMobile }) => {
  await sample(page);
  const m = !!isMobile;
  const style = async (name: string) => {
    await section(page, m, 'Import');
    await (m ? page.getByRole('tabpanel') : page.getByRole('complementary', { name: 'Token settings' })).getByRole('radio', { name }).click();
  };
  await style('Simple');
  let panel = await section(page, m, 'Image');
  await expect(panel.getByRole('button', { name: 'Advanced' })).toHaveCount(0);
  await expect(panel.getByRole('textbox', { name: 'Hue value' })).toHaveCount(0);
  await style('Expert');
  panel = await section(page, m, 'Image');
  await expect(panel.getByRole('button', { name: 'Advanced' })).toHaveCount(0);
  await expect(panel.getByRole('textbox', { name: 'Hue value' })).toBeVisible();
  await page.reload();
  panel = await section(page, m, 'Image');
  await expect(panel.getByRole('textbox', { name: 'Hue value' })).toBeVisible();
});

test('a slider reset button puts its default back as one undo step', async ({ page, isMobile }) => {
  await sample(page);
  const panel = await section(page, !!isMobile, 'Image');
  const box = panel.getByRole('textbox', { name: 'Brightness value' });
  await box.fill('40');
  await box.press('Enter');
  const reset = panel.getByRole('button', { name: 'Reset Brightness' });
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(box).toHaveValue('0');
  await expect(reset).toBeDisabled();
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expect(box).toHaveValue('40');
});

test('the side panel can be dragged wider, and the theme switches between dark and light only', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'phones use the bottom sheet');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const panel = page.getByRole('complementary', { name: 'Token settings' });
  const before = (await panel.boundingBox())!.width;
  const handle = page.getByRole('separator', { name: 'Resize the settings panel' });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x - 120, box.y + 100, { steps: 6 });
  await page.mouse.up();
  const wider = (await panel.boundingBox())!.width;
  expect(wider).toBeGreaterThan(before + 80);
  await page.reload();
  expect(Math.abs((await panel.boundingBox())!.width - wider)).toBeLessThan(4);
  await handle.dblclick();
  expect(Math.abs((await panel.boundingBox())!.width - before)).toBeLessThan(4);

  await page.getByRole('button', { name: /Theme: dark/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: /Theme: light/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('picture effects and decorations, and a plain label turned round its anchor', async ({ page, isMobile }) => {
  await sample(page);
  const m = !!isMobile;
  let panel = await section(page, m, 'Effects');
  await panel.locator('[data-effect-picture="fx-twinkles"]').click();
  const card = panel.getByRole('list', { name: 'Effects, top first' }).getByRole('listitem');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Twinkles');
  await expect(card.getByRole('textbox', { name: 'Blur value' })).toBeVisible();

  panel = await section(page, m, 'Decorations', 'Decor');
  await panel.locator('[data-decoration-picture="deco-heart"]').click();
  await expect(panel.getByRole('list', { name: 'Decorations, top first' }).getByRole('listitem')).toContainText('Heart');

  panel = await section(page, m, 'Label');
  await panel.getByRole('button', { name: 'Add a label' }).click();
  await panel.getByRole('radio', { name: 'Plain text' }).click();
  await panel.getByRole('radio', { name: 'Free' }).click();
  await panel.locator('[data-anchor="left"]').click();
  await expect(panel.locator('[data-anchor="left"]')).toHaveAttribute('aria-checked', 'true');
  const rotation = panel.getByRole('textbox', { name: 'Rotation value' });
  await rotation.fill('-20');
  await rotation.press('Enter');
  await expect(rotation).toHaveValue('-20');
  await expect(panel.getByText('Shape colour')).toHaveCount(0); // no shape behind plain text

  // Everything survives a reload, pictures included.
  await page.waitForTimeout(1200);
  await page.reload();
  panel = await section(page, m, 'Effects');
  await expect(panel.getByRole('list', { name: 'Effects, top first' }).getByRole('listitem')).toContainText('Twinkles');
});

test('Small covers 0.8 of a square and Tiny half of one', async ({ page, isMobile }) => {
  await sample(page);
  const panel = await section(page, !!isMobile, 'Size');
  await panel.getByRole('radio', { name: 'Small' }).click();
  await expect(panel.getByText(/Covers 0.8 of a square/)).toBeVisible();
  await panel.getByRole('radio', { name: 'Tiny' }).click();
  await expect(panel.getByText(/Covers ½ square/)).toBeVisible();
  // All seven size buttons fit inside the panel.
  const row = (await panel.locator('.segmented__row').first().boundingBox())!;
  for (const b of await panel.locator('.segmented__row').first().getByRole('radio').all()) {
    const r = (await b.boundingBox())!;
    expect(r.x + r.width).toBeLessThanOrEqual(row.x + row.width + 1);
  }
});

test('a web link explains when the image server is missing instead of a JSON error', async ({ page, isMobile }) => {
  await page.goto('/');
  // Like a static deploy: every /api address answers with the editor's page.
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Token Maker</title>' }));
  const panel = await section(page, !!isMobile, 'Import');
  await panel.getByLabel('Web address').fill('https://uk.pinterest.com/pin/666392076130436411/');
  await panel.getByRole('button', { name: 'Get' }).click();
  await expect(panel.getByText(/isn't running its image server/)).toBeVisible();
});
