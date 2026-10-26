import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, authenticate } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';
const root = 'artifacts/wo-ui-05/screenshots';
async function shot(page: Page, name: string) {
  await mkdir(root, { recursive: true });
  await page.screenshot({
    path: `${root}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}
const orderList = (page: Page) =>
  page.getByRole('list', { name: '빠른 실행 순서 변경' });
const normalList = (page: Page) =>
  page.getByRole('list', { name: '빠른 실행 목록' });
test('long names preserve fixed controls, icon geometry and focus at desktop boundaries', async ({
  page,
}) => {
  const api = await presetApi(page, 3);
  const name = '아주 긴 이름 日本語 English '.repeat(4);
  api.items[1]!.name = name;
  await page.goto('/');
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const row = orderList(page).getByRole('listitem').nth(1),
      up = row.getByRole('button', { name: `${name} 위로 이동`, exact: true });
    await expect(row.locator(':scope > span').nth(1)).toHaveCSS(
      'text-overflow',
      'ellipsis',
    );
    await expect(up).toHaveCSS('width', '44px');
    await expect(up).toHaveCSS('height', '44px');
    await expect(up.locator('svg')).toHaveCSS('width', '16px');
    await expect(up.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await up.hover();
    await shot(page, `reorder-hover-${width}`);
    await up.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(up).toBeFocused();
    await expect(up).toHaveCSS('outline-width', '2px');
    await shot(page, `reorder-focus-${width}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
for (const count of [0, 1, 2, 6, 8, 30, 50])
  test(`summary-only reorder all ${count}, boundaries, cancel and unchanged completion`, async ({
    page,
  }) => {
    const api = await presetApi(page, count);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    if (!count) {
      await expect(page.getByText('아직 빠른 실행이 없어요.')).toBeVisible();
      await expect(
        page.getByRole('button', { name: '순서 변경', exact: true }),
      ).toHaveCount(0);
      return;
    }
    await expect(
      normalList(page)
        .getByRole('button', { name: '실행', exact: true })
        .first(),
    ).toBeEnabled();
    await expect
      .poll(
        () =>
          api.requests.filter(
            (r) => r.method === 'GET' && r.path.split('/').length === 3,
          ).length,
      )
      .toBe(Math.min(count, 6));
    const details = api.requests.filter(
      (r) => r.method === 'GET' && r.path.split('/').length === 3,
    ).length;
    await page.getByRole('button', { name: '순서 변경', exact: true }).click();
    await expect(orderList(page).getByRole('listitem')).toHaveCount(count);
    await expect(
      page.getByRole('heading', { name: '순서 변경', exact: true }),
    ).toBeFocused();
    await expect(
      orderList(page).getByRole('button', {
        name: '업무 1 위로 이동',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      orderList(page).getByRole('button', {
        name: `업무 ${count} 아래로 이동`,
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      orderList(page).getByRole('button', { name: '실행', exact: true }),
    ).toHaveCount(0);
    const rows = await orderList(page).getByRole('listitem').all();
    if (count > 1) {
      const a = await rows[0]!.boundingBox(),
        b = await rows[1]!.boundingBox();
      expect(a!.x).toBe(b!.x);
      expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height);
      const down = page.getByRole('button', {
        name: '업무 1 아래로 이동',
        exact: true,
      });
      await down.focus();
      await page.keyboard.press('Space');
      await expect(orderList(page).getByRole('listitem').nth(1)).toContainText(
        '업무 1',
      );
      await expect(
        page.getByRole('button', {
          name: `업무 1 ${count === 2 ? '위로' : '아래로'} 이동`,
          exact: true,
        }),
      ).toBeFocused();
      await expect(
        page.getByRole('status').filter({ hasText: '업무 1, 2번째' }),
      ).toBeVisible();
    }
    expect(
      api.requests.filter(
        (r) => r.method === 'GET' && r.path.split('/').length === 3,
      ),
    ).toHaveLength(details);
    expect(api.requests.every((r) => r.method === 'GET')).toBe(true);
    await shot(page, `reorder-${count}`);
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect(
      normalList(page).getByRole('listitem').first(),
    ).toHaveAttribute('aria-label', '빠른 실행 업무 1');
    await expect(
      page.getByRole('button', { name: '순서 변경', exact: true }),
    ).toBeFocused();
    await page.getByRole('button', { name: '순서 변경', exact: true }).click();
    await page.getByRole('button', { name: '완료', exact: true }).click();
    await expect(normalList(page)).toBeVisible();
    expect(api.requests.every((r) => r.method === 'GET')).toBe(true);
  });
test('seventh item enters preview; full PATCH once, reload persistence and show-all remain', async ({
  page,
}) => {
  const api = await presetApi(page, 8);
  await page.goto('/');
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: '업무 7 위로 이동', exact: true })
    .click();
  expect(api.requests.every((r) => r.method === 'GET')).toBe(true);
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(normalList(page).getByRole('listitem').nth(5)).toHaveAttribute(
    'aria-label',
    '빠른 실행 업무 7',
  );
  const requests = api.requests.filter((r) => r.path.endsWith('/reorder'));
  expect(requests).toHaveLength(1);
  expect(requests[0]!.method).toBe('PATCH');
  expect(requests[0]!.body).toEqual({
    presetIds: [
      ...api.items.slice(0, 5),
      api.items[6]!,
      api.items[5]!,
      api.items[7]!,
    ].map((p) => p.id),
  });
  await page.reload();
  await expect(normalList(page).getByRole('listitem').nth(5)).toHaveAttribute(
    'aria-label',
    '빠른 실행 업무 7',
  );
  await page.getByRole('button', { name: '나머지 2개 보기' }).click();
  await expect(normalList(page).getByRole('listitem')).toHaveCount(8);
  await page.getByRole('button', { name: '목록 접기' }).click();
  await expect(normalList(page).getByRole('listitem')).toHaveCount(6);
});
for (const status of [409, 500])
  test(`save ${status} preserves draft and retries explicitly`, async ({
    page,
  }) => {
    const api = await presetApi(page, 8);
    api.failure = status;
    await page.goto('/');
    await page.getByRole('button', { name: '순서 변경', exact: true }).click();
    await page
      .getByRole('button', { name: '업무 2 위로 이동', exact: true })
      .click();
    await page.getByRole('button', { name: '완료', exact: true }).click();
    const failure = page.getByRole('main').getByRole('alert');
    await expect(failure).toBeVisible();
    await expect(failure).toContainText(
      status === 409 ? '변경됐어요' : '연결하지 못했어요',
    );
    await expect(orderList(page).getByRole('listitem').first()).toContainText(
      '업무 2',
    );
    expect(api.items[0]!.sortOrder).toBe(0);
    expect(
      api.requests.filter((r) => r.path.endsWith('/reorder')),
    ).toHaveLength(1);
    api.failure = 0;
    await page.getByRole('button', { name: '완료', exact: true }).click();
    await expect(normalList(page)).toBeVisible();
    expect(
      api.requests.filter((r) => r.path.endsWith('/reorder')),
    ).toHaveLength(2);
  });
test('pending duplicate guard and mobile draft preservation without detail requests', async ({
  page,
}) => {
  const api = await presetApi(page, 8);
  await page.goto('/');
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: '업무 2 위로 이동', exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(orderList(page)).toBeHidden();
  const n = api.requests.length;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(150);
  expect(api.requests).toHaveLength(n);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(orderList(page).getByRole('listitem').first()).toContainText(
    '업무 2',
  );
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route('**/quick-launch-presets/reorder', async (route) => {
    posts++;
    await gate;
    await route.fallback();
  });
  try {
    await page.getByRole('button', { name: '완료', exact: true }).dblclick();
    await expect.poll(() => posts).toBe(1);
    await expect(
      page.getByRole('button', { name: '취소', exact: true }),
    ).toBeDisabled();
    await expect(orderList(page).getByRole('button').first()).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 900 });
  } finally {
    release();
  }
  await expect
    .poll(() => api.items.find((p) => p.name === '업무 2')?.sortOrder)
    .toBe(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(normalList(page).getByRole('listitem').first()).toHaveAttribute(
    'aria-label',
    '빠른 실행 업무 2',
  );
  expect(posts).toBe(1);
});
test('account switch discards reorder draft', async ({ page, context }) => {
  await presetApi(page, 8);
  await page.goto('/');
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: '업무 2 위로 이동', exact: true })
    .click();
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(orderList(page)).toHaveCount(0);
  await expect(normalList(page).getByRole('listitem').first()).toHaveAttribute(
    'aria-label',
    '빠른 실행 업무 1',
  );
});
test('membership changes block incomplete IDs and require explicit restart', async ({
  page,
}) => {
  const api = await presetApi(page, 8);
  await page.goto('/');
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: '업무 2 위로 이동', exact: true })
    .click();
  api.items = api.items.slice(0, 7);
  // Summary queries intentionally do not refetch on window focus. A server
  // conflict invalidates the existing list and reveals concurrent membership.
  api.failure = 409;
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '완료', exact: true }),
  ).toBeDisabled();
  await expect(orderList(page).getByRole('listitem')).toHaveCount(8);
  await page.getByRole('button', { name: '최신 순서로 다시 시작' }).click();
  await expect(orderList(page).getByRole('listitem')).toHaveCount(7);
  expect(api.requests.filter((r) => r.path.endsWith('/reorder'))).toHaveLength(
    1,
  );
});
test('normal card edit aligned right, shared Sheet arrows and visual states', async ({
  page,
}) => {
  await presetApi(page, 2, 3);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(normalList(page).getByRole('listitem')).toHaveCount(2);
  await shot(page, 'home-1440');
  await page.getByRole('button', { name: '업무 1 펼치기' }).click();
  const card = normalList(page).getByRole('listitem', {
      name: '빠른 실행 업무 1',
      exact: true,
    }),
    edit = card.getByRole('button', { name: '편집', exact: true });
  await expect(card.getByRole('button', { name: /이동$/ })).toHaveCount(0);
  const e = await edit.boundingBox(),
    c = await card.boundingBox();
  expect(c!.x + c!.width - e!.x - e!.width).toBeLessThan(20);
  await shot(page, 'expanded-edit-right');
  await edit.click();
  const list = page.getByRole('list', { name: '선택한 링크 순서' }),
    down = list.getByRole('button', { name: /아래로 이동$/ }).first();
  await expect(down.locator('svg')).toHaveClass(/lucide-arrow-down/);
  await expect(down).toHaveText('');
  await expect(down).toHaveCSS('width', '44px');
  const moved = list.getByRole('button', {
    name: (await down.getAttribute('aria-label')) ?? '',
    exact: true,
  });
  await down.hover();
  await shot(page, 'sheet-hover');
  await down.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(down).toHaveCSS('outline-width', '2px');
  await shot(page, 'sheet-focus');
  await page.keyboard.press('Enter');
  await expect(moved).toBeFocused();
  await shot(page, 'sheet-reordered');
});
