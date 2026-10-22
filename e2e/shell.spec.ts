import { expect, test } from '@playwright/test';

test.describe('app shell', () => {
  test('shows the editor without sideways scrolling', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Token Maker home' })).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Image tools' })).toBeVisible();
    await expect(page.getByText('Drop, paste or upload an image')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('wide screens have the side panel and bottom bar', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'phone layout');
    await page.goto('/');
    const panel = page.getByRole('complementary', { name: 'Token settings' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Decorations', exact: true }).click();
    await expect(panel.getByText('Gems, skulls, horns, wings and more.')).toBeVisible();
    // Export waits for an image.
    await expect(page.locator('.bottom-bar').getByRole('button', { name: 'Export PNG' })).toBeDisabled();
  });

  test('phones have a bottom sheet with tabs that can be dragged open', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'wide layout');
    await page.goto('/');
    const sheet = page.locator('.bottom-sheet');
    await expect(sheet).toHaveAttribute('data-snap', 'peek');
    await expect(page.getByRole('tab')).toHaveCount(10);
    await page.getByRole('tab', { name: 'Decor' }).click();
    await expect(sheet).toHaveAttribute('data-snap', 'half');
    await expect(page.getByRole('tabpanel').getByText('Gems, skulls, horns, wings and more.')).toBeVisible();

    // drag the handle up to full height
    const grab = page.locator('.bottom-sheet__grab');
    const box = (await grab.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, 40, { steps: 8 });
    await page.mouse.up();
    await expect(sheet).toHaveAttribute('data-snap', 'full');

    // touch targets are at least 44px
    const tab = (await page.getByRole('tab', { name: 'Import' }).boundingBox())!;
    expect(tab.height).toBeGreaterThanOrEqual(44);
  });

  test('help tips open by click or tap and close with Escape', async ({ page, isMobile }) => {
    await page.goto('/');
    const tip = isMobile
      ? page.getByRole('button', { name: 'Help: Batch mode' })
      : page.getByRole('complementary').getByRole('button', { name: 'Help: Import' });
    await tip.click();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toBeHidden();
  });

  test('the ad slot is off', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('ad-slot')).toHaveCount(0);
  });

  test('About and Privacy pages open from the footer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.getByRole('heading', { name: 'About Token Maker' })).toBeVisible();
    await page.getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
  });
});
