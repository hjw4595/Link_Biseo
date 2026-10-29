import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, authenticate } from './auth-fixture';
import { installProductApi } from './product-fixture';
import { presetApi } from './quick-launch-fixture';

for (const [name, engine] of [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
] as const) {
  test(`AppSheet composition and confirmation in ${name}`, async () => {
    test.setTimeout(60000);
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({
        baseURL: 'http://localhost:3100',
        viewport: { width: 1440, height: 900 },
      });
      await authenticate(context);
      await context.route(
        /^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/,
        (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<p>Mock external</p>',
          }),
      );
      await installProductApi(context);
      const page = await context.newPage();
      const api = await presetApi(page, 1, 8);
      await page.goto('/');
      await page
        .getByRole('button', { name: '업무 1 펼치기', exact: true })
        .click();
      await page.getByRole('button', { name: '편집', exact: true }).click();
      const sheet = page.getByRole('dialog', {
        name: '빠른 실행 편집',
        exact: true,
      });
      const input = sheet.getByLabel('이름', { exact: true });
      await expect(input).toBeFocused();
      await input.fill('브라우저 초안');
      await page.keyboard.press('Escape');
      const confirm = page.getByRole('alertdialog');
      await expect(
        confirm.getByRole('button', { name: '계속 편집', exact: true }),
      ).toBeFocused();
      await mkdir('artifacts/wo-ui-08/browsers', { recursive: true });
      await page.screenshot({
        path: `artifacts/wo-ui-08/browsers/${name}-discard.png`,
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
      await expect(confirm).toHaveCount(0);
      await expect(input).toHaveValue('브라우저 초안');
      await expect(input).toBeFocused();
      await page.setViewportSize({ width: 390, height: 400 });
      await expect
        .poll(async () => Math.round((await sheet.boundingBox())?.width ?? 0))
        .toBe(390);
      expect(Math.round((await sheet.boundingBox())?.height ?? 0)).toBe(400);
      await input.scrollIntoViewIfNeeded();
      await expect(input).toBeInViewport();
      await expect(
        sheet.getByRole('button', { name: '변경 저장', exact: true }),
      ).toBeInViewport();
      const body = sheet.locator('[data-slot="app-sheet-body"]');
      expect(
        await body.evaluate((el) => el.scrollHeight > el.clientHeight),
      ).toBe(true);
      await body.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await mkdir('artifacts/wo-ui-08/browsers', { recursive: true });
      await page.screenshot({
        path: `artifacts/wo-ui-08/browsers/${name}-short-viewport.png`,
        animations: 'disabled',
      });
      await sheet.getByRole('button', { name: '닫기', exact: true }).click();
      await confirm
        .getByRole('button', { name: '변경사항 버리기', exact: true })
        .click();
      await expect(sheet).toHaveCount(0);
      await expect(page.locator('#home-title')).toBeFocused();
      expect(api.requests.every((r) => r.method === 'GET')).toBe(true);
      await writeFile(
        `artifacts/wo-ui-08/browsers/${name}.json`,
        JSON.stringify(
          {
            browser: name,
            version: browser.version(),
            api: 'mock',
            nativeMobile: false,
            result: 'passed',
          },
          null,
          2,
        ),
      );
      await context.close();
    } finally {
      await browser.close();
    }
  });
}
