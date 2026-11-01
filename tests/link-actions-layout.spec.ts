import { mkdir } from 'node:fs/promises';
import { test, expect } from './auth-fixture';
import { fixtureId } from './product-fixture';

const phase = process.env.LINK_ACTION_PHASE === 'before' ? 'before' : 'after';
for (const width of [320, 390, 512, 768, 1024, 1440, 1920]) {
  test(`link list and detail capture ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mkdir(`artifacts/wo-ui-10/compatibility/${phase}`, {
      recursive: true,
    });
    await page.goto('/links');
    await expect(page.getByTestId('link-item')).toHaveCount(8);
    if (phase === 'after') {
      for (const row of await page.getByTestId('link-item').all()) {
        const actions = row.locator(':scope > a, :scope > button');
        await expect(actions).toHaveCount(3);
        await expect(row.locator('a button, button a, a a')).toHaveCount(0);
        const rects = await actions.evaluateAll((nodes) =>
          nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return { x: rect.x, right: rect.right, height: rect.height };
          }),
        );
        for (const rect of rects)
          expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(rects[0]!.right).toBeLessThanOrEqual(rects[1]!.x);
        expect(rects[1]!.right).toBeLessThanOrEqual(rects[2]!.x);
        await expect(
          row.getByRole('button', { name: /즐겨찾기$/ }).locator('svg'),
        ).toHaveCSS('width', '24px');
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.screenshot({
      path: `artifacts/wo-ui-10/compatibility/${phase}/list-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto(`/links/${fixtureId('chatgpt')}`);
    await expect(
      page.getByRole('heading', { name: 'ChatGPT', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/wo-ui-10/compatibility/${phase}/detail-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}
