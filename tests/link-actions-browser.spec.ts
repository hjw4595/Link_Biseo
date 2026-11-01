import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, authenticate } from './auth-fixture';
import { installProductApi } from './product-fixture';

for (const [name, engine] of [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
] as const) {
  test(`detail Sheet, inline edit and confirmation keyboard focus in ${name}`, async () => {
    test.setTimeout(60000);
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({
        baseURL: 'http://localhost:3100',
        viewport: { width: 1440, height: 900 },
      });
      await authenticate(context);
      const api = await installProductApi(context);
      const page = await context.newPage();
      await page.goto('/links');
      const opener = page.getByRole('button', {
        name: 'ChatGPT 상세 보기',
        exact: true,
      });
      await opener.focus();
      await page.keyboard.press('Enter');
      const sheet = page.getByRole('dialog');
      const trigger = sheet.getByRole('button', {
        name: '정보 수정',
        exact: true,
      });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const input = sheet.getByLabel('제목', { exact: true });
      await expect(input).toBeFocused();
      await input.fill('브라우저 초안');
      await page.keyboard.press('Escape');
      const dialog = page.getByRole('alertdialog');
      await expect(
        dialog.getByRole('button', { name: '계속 편집', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(input).toBeFocused();
      await page.setViewportSize({ width: 390, height: 450 });
      await expect
        .poll(async () => Math.round((await sheet.boundingBox())?.width ?? 0))
        .toBe(390);
      await sheet.getByRole('button', { name: '취소', exact: true }).click();
      await expect(
        dialog.getByRole('button', { name: '계속 편집', exact: true }),
      ).toBeFocused();
      await mkdir('artifacts/wo-ui-10/browsers', { recursive: true });
      await page.screenshot({
        path: `artifacts/wo-ui-10/browsers/${name}-discard.png`,
        animations: 'disabled',
      });
      await dialog
        .getByRole('button', { name: '변경 사항 버리기', exact: true })
        .click();
      await expect(sheet).toBeVisible();
      await expect(trigger).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await expect(opener).toBeFocused();
      await page.keyboard.press('Enter');
      const deletion = sheet.getByRole('button', { name: '삭제', exact: true });
      await deletion.focus();
      await page.keyboard.press('Enter');
      await expect(
        dialog.getByRole('button', { name: '취소', exact: true }),
      ).toBeFocused();
      await mkdir('artifacts/wo-ui-10/browsers', { recursive: true });
      await page.screenshot({
        path: `artifacts/wo-ui-10/browsers/${name}-delete.png`,
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
      await expect(deletion).toBeFocused();
      expect(
        api.requests.filter((request) => request.method() !== 'GET'),
      ).toHaveLength(0);
      await writeFile(
        `artifacts/wo-ui-10/browsers/${name}.json`,
        JSON.stringify(
          {
            browser: name,
            version: browser.version(),
            result: 'passed',
            api: 'mock',
            nativeMobile: false,
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
