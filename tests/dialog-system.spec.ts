import { categoryMenu } from './category-ui';
import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';
import { installProductApi } from './product-fixture';

const root = 'artifacts/wo-ui-04/screenshots';
test('category cancel and failure preserve related links; retry removes only the category', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.goto('/categories');
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }),
  ).toBeVisible();
  const user = Array.from(api.users.values())[0]!;
  const category = user.categories[0]!;
  const linkIds = user.links.map((link) => link.id);
  let deletes = 0,
    fail = true;
  await page.route(`**/categories/${category.id}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      deletes++;
      if (fail) return route.fulfill({ status: 500, json: {} });
    }
    return route.fallback();
  });
  const trigger = page.getByRole('button', {
    name: `${category.name} 관리`,
    exact: true,
  });
  await categoryMenu(page, category.name, '삭제');
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(trigger).toBeFocused();
  expect(deletes).toBe(0);
  await categoryMenu(page, category.name, '삭제');
  await dialog.getByRole('button', { name: '카테고리 삭제' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(deletes).toBe(1);
  fail = false;
  await dialog.getByRole('button', { name: '카테고리 삭제' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '카테고리 추가', exact: true }),
  ).toBeFocused();
  expect(deletes).toBe(2);
  expect(user.links.map((link) => link.id)).toEqual(linkIds);
  expect(user.links.some((link) => link.categoryId === category.id)).toBe(
    false,
  );
});
test('long user name wraps and short viewport keeps confirmation buttons reachable', async ({
  page,
}) => {
  const api = await presetApi(page);
  const name = '아주긴사용자이름'.repeat(10);
  api.items[0]!.name = name;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page
    .getByRole('button', { name: `${name} 펼치기`, exact: true })
    .click();
  await page.getByRole('button', { name: '편집', exact: true }).click();
  await page
    .getByRole('button', { name: '빠른 실행 삭제', exact: true })
    .click();
  await page.setViewportSize({ width: 320, height: 320 });
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toHaveAccessibleName(`'${name}'을 삭제할까요?`);
  const box = await dialog.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(288);
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  const cancel = dialog.getByRole('button', { name: '취소' });
  await cancel.scrollIntoViewIfNeeded();
  await expect(cancel).toBeInViewport();
  await shot(page, 'long-name-short-viewport');
  await cancel.click();
  expect(api.requests.some((r) => r.method === 'DELETE')).toBe(false);
});
async function shot(page: Page, name: string) {
  await mkdir(root, { recursive: true });
  await page.screenshot({
    path: `${root}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}
for (const width of [390, 768, 1024, 1440]) {
  test(`shared dialogs keyboard, aria, bounds and screenshots ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dev/ui');
    const dialog = page.getByRole('alertdialog');
    for (const kind of ['일반', '삭제']) {
      const trigger = page.getByRole('button', { name: `${kind} 확인 예시` });
      await trigger.click();
      await expect(dialog).toBeVisible();
      const cancel = dialog.getByRole('button', { name: '돌아가기' });
      await expect(cancel).toBeFocused();
      const box = await dialog.boundingBox();
      expect(box!.width).toBeLessThanOrEqual(400);
      expect(box!.x).toBeGreaterThanOrEqual(15);
      expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(1);
      await expect(dialog).toHaveAccessibleName(
        kind === '일반' ? '변경사항을 적용할까요?' : '이 항목을 삭제할까요?',
      );
      await expect(dialog).toHaveAccessibleDescription(/작업 내용을 확인/);
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: '진행' })).toBeFocused();
      if (kind === '삭제')
        await expect(dialog.getByRole('button', { name: '진행' })).toHaveCSS(
          'color',
          'rgb(216, 106, 112)',
        );
      await page.keyboard.press('Tab');
      await expect(cancel).toBeFocused();
      await page.mouse.click(5, 5);
      await expect(dialog).toBeVisible();
      await shot(
        page,
        `${kind === '일반' ? 'confirm' : 'destructive'}-${width}`,
      );
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(page.getByTestId('confirm-calls')).toHaveText(
        '확인 호출 0회',
      );
    }
    const notice = page.getByRole('button', { name: '필수 안내 예시' });
    await notice.click();
    await expect(dialog).toHaveAccessibleName('필수 안내');
    await expect(dialog.getByRole('button')).toHaveCount(1);
    await expect(
      dialog.getByRole('button', { name: '읽었어요' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await shot(page, `notice-${width}`);
    await page.keyboard.press('Space');
    await expect(dialog).toHaveCount(0);
    await expect(notice).toBeFocused();
  });
  test(`quick launch Sheet nested deletion and retained data ${width}`, async ({
    page,
  }) => {
    const api = await presetApi(page, 1);
    const original = api.items[0]!.links.map((row) => row.link.id);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: '업무 1 펼치기' }).click();
    if (width >= 1024) await shot(page, `expanded-${width}`);
    await page.getByRole('button', { name: '편집', exact: true }).click();
    // Mobile does not expose quick launch. Preserve an already open draft on resize.
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('dialog')).toHaveAccessibleName(
      '빠른 실행 편집',
    );
    await shot(page, `editor-${width}`);
    const trigger = page.getByRole('button', {
      name: '빠른 실행 삭제',
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toHaveAccessibleName("'업무 1'을 삭제할까요?");
    await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
    await shot(page, `sheet-delete-${width}`);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(trigger).toBeFocused();
    expect(api.requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
    await trigger.click();
    api.failure = 500;
    await dialog.getByRole('button', { name: '빠른 실행 삭제' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(api.items[0]!.links.map((row) => row.link.id)).toEqual(original);
    api.failure = 0;
    await dialog.getByRole('button', { name: '빠른 실행 삭제' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(api.items).toHaveLength(0);
    await expect(
      width >= 1024
        ? page.getByRole('heading', { name: '빠른 실행', exact: true })
        : page.locator('#home-title'),
    ).toBeFocused();
    if (width >= 1024) {
      await expect(page.getByText('아직 빠른 실행이 없어요.')).toBeVisible();
      await expect(page.getByText('빠른 실행이 삭제됐어요.')).toBeVisible();
      await shot(page, `empty-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '빠른 실행 추가' }).click();
    await expect(page.getByText('빠른 실행이 삭제됐어요.')).toHaveCount(0);
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('dialog')).toHaveAccessibleName(
      '빠른 실행 추가',
    );
    await expect(page.getByLabel('이름', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: '추가', exact: true }),
    ).toBeDisabled();
    await shot(page, `create-${width}`);
  });
}
test('explicit false and rejection retain popup; async lock blocks duplicate, Escape and cancel; retry closes', async ({
  page,
}) => {
  await page.goto('/dev/ui');
  for (const result of ['false', 'reject']) {
    await page.getByLabel('확인 결과 예시').selectOption(result);
    await page.getByRole('button', { name: '일반 확인 예시' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: '진행' }).click();
    await expect(dialog.getByRole('button', { name: '진행' })).toBeDisabled();
    await expect(
      dialog.getByRole('button', { name: '돌아가기' }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByRole('button', { name: '돌아가기' }).click();
  }
  await expect(page.getByTestId('confirm-calls')).toHaveText('확인 호출 2회');
  await page.getByLabel('확인 결과 예시').selectOption('success');
  await page.getByRole('button', { name: '일반 확인 예시' }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '진행' }).dblclick();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('confirm-calls')).toHaveText('확인 호출 3회');
});
