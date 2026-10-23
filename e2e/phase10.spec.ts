import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Phase 10: polish and launch. A phone pass (every control at least 44 px
// to touch), an accessibility pass (axe in both themes, keyboard use) and
// the first-time experience.

const GOBLIN = readFileSync('e2e/fixtures/flat-goblin.png');

async function loadGoblin(page: Page) {
  await page.getByTestId('file-input').first().setInputFiles({ name: 'goblin.png', mimeType: 'image/png', buffer: GOBLIN });
  await expect(page.locator('.stage')).toHaveAttribute('data-has-art', 'true');
}

/** Opens every closed "Advanced" or similar drop-down inside a container. */
async function openAll(scope: Locator) {
  for (let round = 0; round < 3; round++) {
    const closed = scope.locator('button[aria-expanded="false"]:not([role="tab"]):not(.section__toggle)');
    const n = await closed.count();
    if (!n) return;
    for (let i = n - 1; i >= 0; i--) {
      const b = closed.nth(i);
      if (await b.isVisible()) await b.click().catch(() => {});
    }
  }
}

/** Visible controls smaller than `min` px to touch (counting invisible padding drawn by ::before/::after). */
async function smallTargets(scope: Locator, min: number): Promise<string[]> {
  return scope.evaluate((root, min) => {
    const bad: string[] = [];
    const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="slider"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], label[for]';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(sel))) {
      // The colour picker's input fills its swatch, which is what you touch.
      const r = (el.matches('.swatch--picker input') ? el.parentElement! : el).getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || el.closest('[hidden], [aria-hidden="true"], .visually-hidden')) continue;
      // A text input's label can be any size: the box itself is the target.
      if (el.tagName === 'LABEL') continue;
      let w = r.width;
      let h = r.height;
      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(el, pseudo);
        if (p.content === 'none' || p.position !== 'absolute') continue;
        const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : 0);
        w = Math.max(w, r.width - px(p.left) - px(p.right));
        h = Math.max(h, r.height - px(p.top) - px(p.bottom));
      }
      // Range inputs: the whole row is draggable, so only the height counts.
      if (el instanceof HTMLInputElement && el.type === 'range') w = Math.max(w, min);
      if (w + 0.5 < min || h + 0.5 < min) {
        const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.getAttribute('title') || el.className;
        bad.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(w)}×${Math.round(h)}`);
      }
    }
    return [...new Set(bad)];
  }, min);
}

test.describe('phone pass', () => {
  test('every control in every tab is at least 44 px to touch', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone only');
    test.setTimeout(120_000);
    await page.goto('/');
    await loadGoblin(page);
    const problems: string[] = [];
    problems.push(...(await smallTargets(page.locator('.editor'), 44)).map((p) => `canvas/top: ${p}`));
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    for (let t = 0; t < count; t++) {
      const tab = tabs.nth(t);
      const name = (await tab.textContent())?.trim();
      await tab.click();
      const panel = page.getByRole('tabpanel');
      // Each section in the tab, one at a time (only one is open at once).
      const toggles = panel.locator('.section__toggle');
      const sections = Math.max(1, await toggles.count());
      for (let s = 0; s < sections; s++) {
        const toggle = toggles.nth(s);
        if ((await toggles.count()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
        // Lists start empty: add one of each so their cards are checked too.
        for (const add of ['Add a label', 'Vignette', 'Fire', 'Gem']) {
          const b = panel.getByRole('button', { name: add, exact: true }).first();
          if ((await b.count()) && (await b.isVisible())) await b.click().catch(() => {});
        }
        await openAll(panel);
        problems.push(...(await smallTargets(panel, 44)).map((p) => `${name}: ${p}`));
      }
    }
    expect([...new Set(problems)]).toEqual([]);
  });
});

for (const theme of ['dark', 'light'] as const) {
  test.describe(`accessibility (${theme} theme)`, () => {
    test.use({ colorScheme: theme });

    test('no axe problems in the editor, with every section open', async ({ page, isMobile }) => {
      test.setTimeout(180_000);
      await page.goto('/');
      await loadGoblin(page);
      const problems = new Map<string, string>();
      const scan = async (where: string) => {
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.stage canvas').analyze();
        for (const v of r.violations) for (const n of v.nodes) problems.set(`${v.id}: ${n.target.join(' ')}`, `${where} — ${n.failureSummary?.split('\n')[1] ?? ''}`);
      };
      await scan('start');
      if (isMobile) {
        const tabs = page.getByRole('tab');
        for (let t = 0; t < (await tabs.count()); t++) {
          await tabs.nth(t).click();
          const panel = page.getByRole('tabpanel');
          const toggles = panel.locator('.section__toggle');
          for (let s = 0; s < Math.max(1, await toggles.count()); s++) {
            if ((await toggles.count()) && (await toggles.nth(s).getAttribute('aria-expanded')) === 'false') await toggles.nth(s).click();
            await openAll(panel);
            await scan(`tab ${t} section ${s}`);
          }
        }
      } else {
        const panel = page.getByRole('complementary', { name: 'Token settings' });
        const toggles = panel.locator('.section__toggle');
        for (let s = 0; s < (await toggles.count()); s++) {
          if ((await toggles.nth(s).getAttribute('aria-expanded')) === 'false') await toggles.nth(s).click();
          for (const add of ['Add a label', 'Vignette', 'Fire', 'Gem']) {
            const b = panel.getByRole('button', { name: add, exact: true }).first();
            if ((await b.count()) && (await b.isVisible())) await b.click().catch(() => {});
          }
          await openAll(panel);
          await scan(`section ${s}`);
        }
      }
      expect([...problems].map(([k, v]) => `${k} (${v})`)).toEqual([]);
    });

    test('no axe problems on the About, Privacy and UI kit pages', async ({ page }) => {
      for (const path of ['/about', '/privacy', '/kit']) {
        await page.goto(path);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r.violations.flatMap((v) => v.nodes.map((n) => `${path} ${v.id}: ${n.target.join(' ')}`))).toEqual([]);
      }
    });
  });
}

test.describe('keyboard', () => {
  test('Tab reaches the controls in order, each with a visible focus ring', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'keyboard use is checked on the wide layouts');
    await page.goto('/');
    await loadGoblin(page);
    const seen = new Set<string>();
    const missing: string[] = [];
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
        const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.tagName;
        return { key: `${el.tagName}:${name}:${Math.round(r.x)},${Math.round(r.y)}`, name, ring, shown: r.width > 0 && r.height > 0 };
      });
      if (!info) continue;
      seen.add(info.key);
      if (!info.ring || !info.shown) missing.push(info.name);
    }
    expect(seen.size).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });

  test('a token can be styled with the keyboard alone', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'keyboard use is checked on the wide layouts');
    await page.goto('/');
    await loadGoblin(page);
    const panel = page.getByRole('complementary', { name: 'Token settings' });
    await panel.getByRole('button', { name: 'Frame & shape', exact: true }).focus();
    await page.keyboard.press('Enter');
    const circle = panel.getByRole('radio', { name: 'Circle' });
    await circle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(panel.getByRole('radio', { name: 'Rounded' })).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByRole('radio', { name: 'Rounded' })).toBeFocused();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    await expect(circle).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('performance', () => {
  // A mid-range phone: the CPU slowed down four times (Chromium only).
  test('sliders stay smooth on a slowed-down phone', async ({ page, isMobile, browserName }) => {
    test.skip(!isMobile || browserName !== 'chromium', 'phone, Chromium');
    test.setTimeout(90_000);
    await page.goto('/');
    await loadGoblin(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const results: string[] = [];
    for (const [tab, name] of [['Image', 'Brightness'], ['Frame', 'Thickness']] as const) {
      await page.getByRole('tab', { name: tab }).click();
      const slider = page.getByRole('tabpanel').getByRole('slider', { name, exact: true });
      await slider.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const box = (await slider.boundingBox())!;
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
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.5, y);
      await page.mouse.down();
      for (let i = 0; i <= 30; i++) await page.mouse.move(box.x + box.width * (0.5 + 0.4 * Math.sin(i / 5)), y);
      await page.mouse.up();
      const gaps = await page.evaluate(() => {
        const w = window as unknown as { __gaps: number[]; __stop: boolean };
        w.__stop = true;
        return w.__gaps.slice(1);
      });
      gaps.sort((a, b) => a - b);
      const median = gaps[Math.floor(gaps.length / 2)]!;
      results.push(`${name}: median ${median.toFixed(0)} ms, 90% ${gaps[Math.floor(gaps.length * 0.9)]!.toFixed(0)} ms over ${gaps.length} frames`);
      expect(median, results.join('; ')).toBeLessThan(50);
    }
    console.log(results.join('\n'));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
});

test.describe('pages', () => {
  test('About and Privacy fit the screen without sideways scrolling', async ({ page }) => {
    for (const path of ['/about', '/privacy']) {
      await page.goto(path);
      await page.getByRole('heading', { level: 1 }).waitFor();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('first visit', () => {
  test('the empty token invites an import, and "Try a sample" loads the goblin', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.stage__empty');
    await expect(card.getByText('Drop, paste or upload an image')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Upload image' })).toBeInViewport();
    await expect(card.getByRole('list', { name: 'How it works' }).getByRole('listitem')).toHaveCount(3);
    await card.getByRole('button', { name: 'Try a sample' }).click();
    await expect(page.locator('.stage')).toHaveAttribute('data-has-art', 'true');
    await expect(card).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Token preview: Goblin' })).toBeVisible();
    // It is an ordinary import: one undo step takes it away again.
    await page.keyboard.press('Control+z');
    await expect(page.locator('.stage')).not.toHaveAttribute('data-has-art', 'true');
  });
});
