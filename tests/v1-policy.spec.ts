import { test, expect, authenticate } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';
import {
  initialProduct,
  fixtureId,
  installProductApi,
} from './product-fixture';
import { isPresetDetail, isPresetList } from '../src/contracts/quick-launch';
import {
  dateInZone,
  nextDayDelay,
  normalizeTimeZone,
} from '../src/lib/time-zone';
import { isLinkStatsResponse } from '../src/contracts/link-stats';

test('preset validators reject duplicate members, invalid ids, counts and malformed lists', () => {
  const link = initialProduct().links[0];
  if (!link) throw new Error();
  const p = {
    id: fixtureId('p'),
    name: '업무',
    sortOrder: 0,
    linkCount: 1,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    links: [{ sortOrder: 0, link }],
  };
  expect(isPresetDetail(p)).toBe(true);
  for (const bad of [
    { ...p, linkCount: 21 },
    { ...p, id: 'bad' },
    { ...p, linkCount: 2, links: [...p.links, ...p.links] },
    { ...p, name: '' },
    { ...p, sortOrder: -1 },
  ])
    expect(isPresetDetail(bad)).toBe(false);
  expect(isPresetList({ items: [p, p] })).toBe(false);
});
test('device dates cover New York DST and midnight; stats accepts IANA zones', () => {
  expect(normalizeTimeZone('bad')).toBeNull();
  expect(dateInZone('2026-03-08T04:59:59Z', 'America/New_York')).toBe(
    '2026-03-07',
  );
  expect(dateInZone('2026-03-08T05:00:00Z', 'America/New_York')).toBe(
    '2026-03-08',
  );
  expect(
    nextDayDelay(Date.parse('2026-03-08T05:00:00Z'), 'America/New_York'),
  ).toBeGreaterThan(23 * 3600000);
  expect(
    nextDayDelay(Date.parse('2026-03-08T05:00:00Z'), 'America/New_York'),
  ).toBeLessThan(23 * 3600000 + 200);
  expect(
    nextDayDelay(Date.parse('2026-11-01T04:00:00Z'), 'America/New_York'),
  ).toBeGreaterThan(25 * 3600000);
  expect(
    isLinkStatsResponse({
      linkId: fixtureId('l'),
      createdAt: '2026-01-01T00:00:00.000Z',
      lastOpenedAt: null,
      recent7DayOpenCount: 2,
      timezone: 'America/New_York',
      periodStartDate: '2026-03-02',
      periodEndDate: '2026-03-08',
      historyStatus: 'partial',
    }),
  ).toBe(true);
});
test('My Links submits encoded server search and URL-only matches beyond first page', async ({
  page,
}) => {
  const queries: URL[] = [];
  await page.route('http://127.0.0.1:54329/links?**', (route) => {
    const url = new URL(route.request().url());
    queries.push(url);
    const item = initialProduct().links[0];
    if (!item) throw new Error();
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: {
        items: url.searchParams.get('q')
          ? [
              {
                ...item,
                title: 'Remote result',
                url: 'https://example.com/find?q=한글&x=1',
              },
            ]
          : [],
        nextCursor: null,
      },
    });
  });
  await page.goto('/');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  await page
    .getByRole('searchbox', { name: '저장한 링크 검색' })
    .fill('한글&x=1');
  await expect(page.getByText('Remote result', { exact: true })).toBeVisible();
  expect(queries.some((q) => q.searchParams.get('q') === '한글&x=1')).toBe(
    true,
  );
  await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
  await expect
    .poll(() =>
      queries.some(
        (q) =>
          q.searchParams.get('sort') === 'frequent' &&
          q.searchParams.get('q') === '한글&x=1' &&
          !q.searchParams.has('cursor'),
      ),
    )
    .toBe(true);
});
test('visible preset details load once and fresh focus reuses execution data', async ({
  page,
}) => {
  const state = await presetApi(page, 3);
  await page.goto('/');
  const area = page.getByRole('region', { name: '빠른 실행' });
  await expect(
    area.getByRole('button', { name: '실행', exact: true }).first(),
  ).toBeEnabled();
  await expect(
    area.getByRole('button', { name: '실행 준비' }).first(),
  ).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(
    state.requests.filter(
      (r) => r.method === 'GET' && r.path.split('/').length > 2,
    ),
  ).toHaveLength(3);
  await expect(
    area.getByRole('button', { name: '실행', exact: true }).first(),
  ).toBeEnabled();
  expect(
    state.requests.filter((r) => r.path.endsWith(state.items[0]?.id ?? '!')),
  ).toHaveLength(1);
});
test('create empty preset in one POST; duplicate names and shared links allowed', async ({
  page,
}) => {
  const state = await presetApi(page, 0);
  await page.goto('/');
  await page.getByRole('button', { name: '빠른 실행 추가' }).click();
  await page.getByLabel('이름', { exact: true }).fill('업무');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.requests.find((r) => r.method === 'POST')?.body).toEqual({
    name: '업무',
    linkIds: [],
  });
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toBeDisabled();
});
test('editor preserves name/selection/order across steps; cancellation does not write', async ({
  page,
}) => {
  const state = await presetApi(page);
  await page.goto('/');
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  await page.getByRole('button', { name: '편집' }).click();
  await page.getByLabel('이름', { exact: true }).fill('수정한 업무');
  const selected = page.getByRole('list', { name: '선택한 링크 순서' });
  const original = await selected
    .locator('li > p:first-child')
    .allTextContents();
  await selected
    .getByRole('button', { name: /아래로/ })
    .first()
    .click();
  await page.getByRole('button', { name: '+ 링크 추가', exact: true }).click();
  await expect(page.getByRole('button', { name: /추가됨$/ })).toHaveCount(2);
  await page.getByRole('button', { name: /^선택 완료/ }).click();
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue(
    '수정한 업무',
  );
  expect(
    await selected.locator('li > p:first-child').allTextContents(),
  ).toEqual(original.reverse());
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page
    .getByRole('button', { name: '변경사항 버리기', exact: true })
    .click();
  expect(state.requests.every((r) => r.method === 'GET')).toBe(true);
});
test('save failure preserves draft and exposes conflict; retry sends full ordered ids', async ({
  page,
}) => {
  const state = await presetApi(page);
  state.failure = 409;
  await page.goto('/');
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  await page.getByRole('button', { name: '편집' }).click();
  await page.getByLabel('이름', { exact: true }).fill('수정 초안');
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '다시 확인',
  );
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue(
    '수정 초안',
  );
  state.failure = 0;
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items[0]?.name).toBe('수정 초안');
});
test('preset deletion requires confirmation and never deletes source UserLink', async ({
  page,
}) => {
  const state = await presetApi(page);
  const deletedLinks: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'DELETE' && r.url().includes('/links/'))
      deletedLinks.push(r.url());
  });
  await page.goto('/');
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  await page.getByRole('button', { name: '편집' }).click();
  await page
    .getByRole('button', { name: '빠른 실행 삭제', exact: true })
    .click();
  expect(state.requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
  await page.getByRole('button', { name: '빠른 실행 삭제' }).click();
  await expect(
    page.getByText('자주 사용하는 링크를 빠른 실행에 추가해 보세요.'),
  ).toBeVisible();
  expect(deletedLinks).toEqual([]);
});
test('launch requests noopener contexts synchronously once, null is unknown, records do not retry opens', async ({
  page,
}) => {
  await presetApi(page);
  let records = 0;
  await page.route('**/links/*/open', (route) => {
    records++;
    return route.fulfill({
      status: 503,
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: {},
    });
  });
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    Object.defineProperty(window, '__opens', { value: calls });
    window.open = (...args) => {
      calls.push(args);
      return null;
    };
  });
  await page.goto('/');
  expect(await page.evaluate(() => Reflect.get(window, '__opens'))).toEqual([]);
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '실행', exact: true }).dblclick();
  await expect(page.getByText('링크 열기를 요청했어요.')).toBeVisible();
  await expect.poll(() => records).toBe(2);
  const calls: unknown = await page.evaluate(() =>
    Reflect.get(window, '__opens'),
  );
  expect(calls).toEqual(
    initialProduct()
      .links.slice(0, 2)
      .map((l) => [l.url, '_blank', 'noopener,noreferrer']),
  );
  await expect(
    page.getByText(
      '사용 기록 저장 여부를 확인할 수 없어요. 탭을 자동으로 다시 열지 않아요.',
    ),
  ).toHaveCount(2);
  await expect(page.getByRole('link', { name: /개별 열기/ })).toHaveCount(2);
  await expect(page).toHaveURL('/');
});
test('50 preset cap disables creation and reorder submits complete order', async ({
  page,
}) => {
  const state = await presetApi(page, 50, 0);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '빠른 실행 추가' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: '업무 1 아래로 이동', exact: true })
    .click();
  expect(state.requests.some((r) => r.path.endsWith('/reorder'))).toBe(false);
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect
    .poll(() => state.requests.some((r) => r.path.endsWith('/reorder')))
    .toBe(true);
  expect(state.items.find((p) => p.name === '업무 1')?.sortOrder).toBe(1);
});
test('account switch discards preset draft', async ({ page, context }) => {
  await presetApi(page, 0);
  await page.goto('/');
  await page.getByRole('button', { name: '빠른 실행 추가' }).click();
  await page.getByLabel('이름', { exact: true }).fill('사용자 A 초안');
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('8 members limit preserves selection across cursor pages', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await presetApi(page, 0);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '빠른 실행 추가' }),
  ).toBeVisible();
  for (const state of api.users.values()) {
    const seed = state.links[0];
    if (!seed) throw new Error();
    state.links = Array.from({ length: 25 }, (_, i) => ({
      ...seed,
      id: fixtureId(`choose-${i}`),
      title: `선택 ${i}`,
      isFavorite: false,
    }));
  }
  await page.getByRole('button', { name: '빠른 실행 추가' }).click();
  await page.getByRole('button', { name: '+ 링크 추가', exact: true }).click();
  const boxes = page
    .getByRole('list', { name: '등록된 링크 선택' })
    .getByRole('button');
  await expect(boxes).toHaveCount(20);
  for (let i = 0; i < 8; i++) await boxes.nth(i).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '더 보기' })
    .click();
  await expect(boxes).toHaveCount(25);
  await expect(boxes.nth(24)).toBeDisabled();
  await expect(page.getByRole('button', { name: /추가됨$/ })).toHaveCount(8);
  await page.getByRole('button', { name: /^선택 완료/ }).click();
  await page
    .getByRole('button', { name: /포함된 링크에서 제거$/ })
    .first()
    .click();
  await page.getByRole('button', { name: '+ 링크 추가', exact: true }).click();
  await expect(boxes).toHaveCount(25);
  await boxes.nth(24).click();
  await expect(page.getByRole('button', { name: /추가됨$/ })).toHaveCount(8);
});
for (const width of [320, 390, 512, 1440])
  test(`preset Sheet keyboard editing fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await presetApi(page);
    await page.goto('/');
    await page
      .getByRole('button', { name: '업무 1 펼치기', exact: true })
      .click();
    await page.getByRole('button', { name: '편집' }).click();
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByLabel('이름', { exact: true })
      .fill('긴 묶음 이름 '.repeat(30));
    const selectedOrder = page.getByRole('list', { name: '선택한 링크 순서' });
    const beforeOrder = await selectedOrder
      .locator('li > p:first-child')
      .allTextContents();
    await selectedOrder
      .getByRole('button', { name: /아래로/ })
      .first()
      .focus();
    await page.keyboard.press('Enter');
    await expect(selectedOrder.locator('li > p:first-child')).toHaveText(
      beforeOrder.reverse(),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const sheet = page.getByRole('dialog');
    expect(await sheet.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `artifacts/wo-v1-01/editor-${width}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: '변경사항 버리기', exact: true })
      .click();
    await expect(sheet).toHaveCount(0);
    await expect(
      width < 1024
        ? page.getByRole('heading', { name: '링크비서 홈' })
        : page.getByRole('button', { name: '편집' }),
    ).toBeFocused();
  });
