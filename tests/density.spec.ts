import { test, expect } from './auth-fixture';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expectClearOfNavigation,
  expectLayoutWidth,
} from './layout-assertions';

for (const width of [320, 390, 430, 512, 1440]) {
  test(`density comparison at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const phase =
      process.env.UI_CAPTURE_PHASE === 'before' ? 'before' : 'after';
    const directory = path.resolve(process.cwd(), 'artifacts/wo-001.1', phase);
    await mkdir(directory, { recursive: true });
    for (const [name, route] of [
      ['home', '/'],
      ['category', '/category/32e83e92-d45d-41f6-8dcf-9d214688f037'],
      ['empty', '/category/d70afca6-1520-4838-8a3d-858e60dda12f'],
      ['long-detail', '/links/aee040a5-82bb-4aaa-86b5-4d4e16b84281'],
    ]) {
      if (!name || !route) throw new Error('Missing capture route');
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const metrics = await page.evaluate(() => {
        const bento = document
          .querySelector('[aria-label="내 카테고리"]')
          ?.getBoundingClientRect();
        const item = document
          .querySelector('[data-testid="link-item"]')
          ?.getBoundingClientRect();
        const heading = document.querySelector('h1');
        return {
          viewport: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bentoHeight: bento?.height,
          firstItemY: item?.top,
          itemHeight: item?.height,
          titleHeight: heading?.getBoundingClientRect().height,
          titleSize: heading ? getComputedStyle(heading).fontSize : null,
        };
      });
      expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
      await expectLayoutWidth(page);
      if (metrics.itemHeight)
        expect(metrics.itemHeight).toBeGreaterThanOrEqual(64);
      await page.screenshot({
        path: path.join(directory, `${name}-${width}.png`),
        fullPage: true,
      });
      await writeFile(
        path.join(directory, `${name}-${width}.json`),
        JSON.stringify(metrics, null, 2),
      );
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expectClearOfNavigation(page, page.locator('.screen-content'));
    }
  });
}
