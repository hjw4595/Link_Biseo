import { mkdir } from 'node:fs/promises';
import { test, expect } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';

const phase = process.env.APP_SHEET_PHASE === 'before' ? 'before' : 'after';
for (const width of [320, 390, 512, 768, 1024, 1440, 1920]) {
  test(`editor and picker capture ${width}`, async ({ page }) => {
    await presetApi(page, 1, 8);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page
      .getByRole('button', { name: '업무 1 펼치기', exact: true })
      .click();
    await page.getByRole('button', { name: '편집', exact: true }).click();
    const sheet = page.getByRole('dialog', {
      name: '빠른 실행 편집',
      exact: true,
    });
    await expect(sheet.getByLabel('이름', { exact: true })).toHaveValue(
      '업무 1',
    );
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (phase === 'after') {
      await expect
        .poll(async () => {
          const box = await sheet.boundingBox();
          return box ? Math.round(box.x + box.width) : 0;
        })
        .toBe(width);
      const box = await sheet.boundingBox();
      expect(Math.round(box?.width ?? 0)).toBe(width < 1024 ? width : 512);
      expect(Math.round(box?.height ?? 0)).toBe(900);
    }
    const editorBox = await sheet.boundingBox();
    await mkdir(`artifacts/wo-ui-08/${phase}`, { recursive: true });
    await page.screenshot({
      path: `artifacts/wo-ui-08/${phase}/editor-${width}.png`,
      animations: 'disabled',
    });
    await sheet
      .getByRole('button', { name: '+ 링크 추가', exact: true })
      .click();
    await expect(
      sheet.getByRole('list', { name: '등록된 링크 선택' }),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    if (phase === 'after') expect(await sheet.boundingBox()).toEqual(editorBox);
    await page.screenshot({
      path: `artifacts/wo-ui-08/${phase}/picker-${width}.png`,
      animations: 'disabled',
    });
  });
}
