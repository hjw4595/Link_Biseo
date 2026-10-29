import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';

const root = 'artifacts/wo-ui-08/after';
async function edit(page: Page, width = 1440, members = 2) {
  const api = await presetApi(page, 1, members);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  const trigger = page.getByRole('button', { name: '편집', exact: true });
  await trigger.click();
  const sheet = page.getByRole('dialog', {
    name: '빠른 실행 편집',
    exact: true,
  });
  await expect(sheet.getByLabel('이름', { exact: true })).toHaveValue('업무 1');
  await page.setViewportSize({ width, height: 900 });
  return { api, sheet, trigger };
}
async function shot(page: Page, name: string) {
  await mkdir(root, { recursive: true });
  await page.screenshot({
    path: `${root}/${name}.png`,
    animations: 'disabled',
  });
}
for (const width of [390, 1440]) {
  for (const method of [
    'x',
    'escape',
    'cancel',
    ...(width >= 1024 ? ['overlay'] : []),
  ]) {
    test(`all close requests respect the feature discard policy: ${method} ${width}`, async ({
      page,
    }) => {
      const { api, sheet } = await edit(page, width);
      const close = async () => {
        if (method === 'x')
          await sheet
            .getByRole('button', { name: '닫기', exact: true })
            .click();
        else if (method === 'escape') await page.keyboard.press('Escape');
        else if (method === 'cancel')
          await sheet
            .getByRole('button', { name: '취소', exact: true })
            .click();
        else await page.mouse.click(5, 5);
      };
      await sheet.getByLabel('이름', { exact: true }).fill('보존할 초안');
      await close();
      const confirm = page.getByRole('alertdialog');
      await expect(confirm).toHaveAccessibleName(
        '저장하지 않은 변경사항을 버릴까요?',
      );
      await expect(
        confirm.getByRole('button', { name: '계속 편집', exact: true }),
      ).toBeFocused();
      await shot(page, `discard-${method}-${width}`);
      await page.mouse.click(5, 5);
      await expect(confirm).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(confirm).toHaveCount(0);
      await expect(sheet).toBeVisible();
      await expect(sheet.getByLabel('이름', { exact: true })).toHaveValue(
        '보존할 초안',
      );
      await expect
        .poll(() =>
          sheet.evaluate((node) => node.contains(document.activeElement)),
        )
        .toBe(true);
      await close();
      await confirm
        .getByRole('button', { name: '변경사항 버리기', exact: true })
        .click();
      await expect(sheet).toHaveCount(0);
      expect(api.requests.every((r) => r.method === 'GET')).toBe(true);
      if (width >= 1024)
        await expect(
          page.getByRole('button', { name: '편집', exact: true }),
        ).toBeFocused();
      else await expect(page.locator('#home-title')).toBeFocused();
    });
  }
  test(`pending save blocks every exit; failure keeps draft and retry commits once ${width}`, async ({
    page,
  }) => {
    const { api, sheet } = await edit(page, width);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writes = 0;
    api.failure = 503;
    await page.route('**/quick-launch-presets/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      writes++;
      if (writes === 1) await gate;
      return route.fallback();
    });
    await sheet.getByLabel('이름', { exact: true }).fill('재시도 초안');
    await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(
      sheet.getByRole('button', { name: '닫기', exact: true }),
    ).toBeDisabled();
    await expect(
      sheet.getByRole('button', { name: '취소', exact: true }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    if (width >= 1024) await page.mouse.click(5, 5);
    await expect(sheet).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await shot(page, `saving-${width}`);
    release();
    await expect(sheet.getByRole('alert')).toBeVisible();
    await expect(sheet.getByLabel('이름', { exact: true })).toHaveValue(
      '재시도 초안',
    );
    expect(writes).toBe(1);
    await shot(page, `save-error-${width}`);
    api.failure = 0;
    await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(sheet).toHaveCount(0);
    expect(writes).toBe(2);
    expect(api.items[0]?.name).toBe('재시도 초안');
  });
  test(`create, picker draft, deletion confirmation and no extra detail reads ${width}`, async ({
    page,
  }) => {
    const { api, sheet, trigger } = await edit(page, width);
    await sheet
      .getByRole('button', { name: '빠른 실행 삭제', exact: true })
      .click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toHaveAccessibleName("'업무 1'을 삭제할까요?");
    await shot(page, `delete-${width}`);
    await confirm.getByRole('button', { name: '취소', exact: true }).click();
    await expect(
      sheet.getByRole('button', { name: '빠른 실행 삭제', exact: true }),
    ).toBeFocused();
    await sheet.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    const reads = api.requests.filter(
      (r) => r.method === 'GET' && r.path.includes('/quick-launch-presets/'),
    ).length;
    await trigger.click();
    await expect(sheet.getByLabel('이름', { exact: true })).toHaveValue(
      '업무 1',
    );
    await sheet.getByRole('button', { name: '닫기', exact: true }).click();
    expect(
      api.requests.filter(
        (r) => r.method === 'GET' && r.path.includes('/quick-launch-presets/'),
      ),
    ).toHaveLength(reads);
    await page
      .getByRole('button', { name: '빠른 실행 추가', exact: true })
      .click();
    await page.setViewportSize({ width, height: 900 });
    const create = page.getByRole('dialog', {
      name: '빠른 실행 추가',
      exact: true,
    });
    await expect(create.getByLabel('이름', { exact: true })).toBeFocused();
    await shot(page, `create-${width}`);
    await create.getByLabel('이름', { exact: true }).fill('새 빠른 실행');
    await create
      .getByRole('button', { name: '+ 링크 추가', exact: true })
      .click();
    const body = create.locator('[data-slot="app-sheet-body"]');
    expect(
      await body.evaluate(
        (el) =>
          el.parentElement?.querySelectorAll('[data-slot="app-sheet-footer"]')
            .length,
      ),
    ).toBe(1);
    await create
      .getByRole('button', { name: 'ChatGPT 추가', exact: true })
      .click();
    await create.getByRole('button', { name: /^선택 완료/ }).click();
    await expect(create.getByLabel('이름', { exact: true })).toHaveValue(
      '새 빠른 실행',
    );
    await expect(
      create
        .getByRole('list', { name: '선택한 링크 순서' })
        .getByRole('listitem'),
    ).toHaveCount(1);
    expect(api.requests.every((r) => r.method === 'GET')).toBe(true);
    await create.getByRole('button', { name: '추가', exact: true }).click();
    await expect(create).toHaveCount(0);
    expect(api.items.find((p) => p.name === '새 빠른 실행')?.linkCount).toBe(1);
  });
}
