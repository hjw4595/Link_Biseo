import { selectLinkFilter } from './link-filter-helper';
import { test, expect } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';
import { initialProduct, fixtureId } from './product-fixture';
const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
for (const status of [400, 401, 500])
  test(`server search ${status} remains an error, not empty or local results`, async ({
    page,
  }) => {
    await page.route('http://127.0.0.1:54329/links?**', (route) =>
      route.fulfill({ status, headers, json: {} }),
    );
    await page.goto('/links?q=needle');
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(page.getByText('아직 링크가 없어요')).toHaveCount(0);
  });
test('search switches keys and opaque cursors, discards late responses, and clears to normal list', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: URL[] = [];
  await page.route('http://127.0.0.1:54329/links?**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const q = url.searchParams.get('q');
    if (q === 'slow') await gate;
    const seed = initialProduct().links[0];
    if (!seed) throw new Error();
    await route.fulfill({
      headers,
      json: {
        items: [
          {
            ...seed,
            id: fixtureId(url.searchParams.has('cursor') ? 'second' : 'first'),
            title:
              q === 'slow'
                ? 'Late old result'
                : q === 'fast'
                  ? 'Fresh result'
                  : 'Normal list',
          },
        ],
        nextCursor:
          q === 'fast' && !url.searchParams.has('cursor')
            ? 'opaque.next'
            : null,
      },
    });
  });
  await page.goto('/links');
  const search = page.getByRole('searchbox');
  await search.fill('slow');
  await expect
    .poll(() => requests.some((u) => u.searchParams.get('q') === 'slow'))
    .toBe(true);
  await search.fill('fast');
  await expect(page.getByText('Fresh result', { exact: true })).toBeVisible();
  release();
  await expect(page.getByText('Late old result')).toHaveCount(0);
  await page.getByRole('button', { name: '더 보기' }).click();
  await expect
    .poll(() =>
      requests.some(
        (u) =>
          u.searchParams.get('cursor') === 'opaque.next' &&
          u.searchParams.get('q') === 'fast',
      ),
    )
    .toBe(true);
  await selectLinkFilter(page, 'favorites');
  await expect
    .poll(() =>
      requests.some(
        (u) =>
          u.searchParams.get('favorite') === 'true' &&
          !u.searchParams.has('cursor'),
      ),
    )
    .toBe(true);
  await search.fill('');
  await expect(page.getByText('Normal list', { exact: true })).toBeVisible();
});
for (const status of [404, 500])
  test(`preset service ${status} distinguishes unavailable from connection failure`, async ({
    page,
  }) => {
    const state = await presetApi(page);
    state.listFailure = status;
    await page.goto('/');
    await expect(
      page.getByRole('region', { name: '빠른 실행' }).getByRole('alert'),
    ).toContainText(status === 404 ? '아직 제공되지' : '연결하지 못');
    await expect(
      page.getByRole('button', { name: '빠른 실행 추가' }),
    ).toHaveCount(0);
  });
test('fresh detail excludes deleted members and invalid URLs never record', async ({
  page,
}) => {
  const state = await presetApi(page);
  const item = state.items[0];
  if (!item) throw new Error();
  const first = item.links[0];
  if (!first) throw new Error();
  first.link.url = 'javascript:alert(1)';
  let opens = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/open')) opens++;
  });
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '실행', exact: true }).click();
  await expect(page.getByText('열기 요청을 보내지 않았어요.')).toBeVisible();
  await expect.poll(() => opens).toBe(1);
  item.links = [];
  item.linkCount = 0;
  await page.clock.install();
  await page.clock.fastForward(16000);
  // Remote deletion is reconciled on reconnect, not by elapsed-time polling.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  await expect
    .poll(
      () =>
        state.requests.filter(
          (r) => r.method === 'GET' && r.path.endsWith(item.id),
        ).length,
    )
    .toBe(2);
  await expect(
    page.getByText('포함된 링크가 없어요. 편집에서 링크를 추가해 주세요.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('link', { name: /개별 열기/ })).toHaveCount(0);
});
test('same saved links can be selected for multiple same-name presets, with no duplicate membership', async ({
  page,
}) => {
  const state = await presetApi(page, 1);
  await page.goto('/');
  await page.getByRole('button', { name: '빠른 실행 추가' }).click();
  await page.getByLabel('이름', { exact: true }).fill('업무 1');
  await page.getByRole('button', { name: '+ 링크 추가', exact: true }).click();
  const name = state.items[0]?.links[0]?.link.title;
  if (!name) throw new Error();
  await page.getByRole('button', { name: `${name} 추가`, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `${name} 추가됨`, exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /^선택 완료/ }).click();
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items).toHaveLength(2);
  expect(state.items[1]?.links).toHaveLength(1);
  expect(state.items[1]?.links[0]?.link.id).toBe(
    state.items[0]?.links[0]?.link.id,
  );
});
test('all invalid links never claim an open request or send usage records', async ({
  page,
}) => {
  const state = await presetApi(page);
  for (const item of state.items)
    for (const entry of item.links) entry.link.url = 'javascript:alert(1)';
  let records = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/open')) records++;
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '실행', exact: true }).click();
  await expect(
    page.getByText('열기 요청을 보내지 못했어요. 링크 URL을 확인해 주세요.'),
  ).toBeVisible();
  await expect(
    page.getByText('링크 열기를 요청했어요.', { exact: true }),
  ).toHaveCount(0);
  expect(records).toBe(0);
});
test.describe('device stats', () => {
  test.use({ timezoneId: 'America/New_York' });
  test('New York response range and partial history shown; wrong-zone response rejected', async ({
    page,
  }) => {
    let wrong = false;
    const zones: string[] = [];
    const id = fixtureId('chatgpt');
    await page.route(`**/links/${id}/stats?*`, (route) => {
      const zone =
        new URL(route.request().url()).searchParams.get('timeZone') ?? '';
      zones.push(zone);
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const start = new Date(Date.parse(day) - 6 * 86400000)
        .toISOString()
        .slice(0, 10);
      return route.fulfill({
        headers,
        json: {
          linkId: id,
          createdAt: '2026-01-01T00:00:00.000Z',
          lastOpenedAt: null,
          recent7DayOpenCount: 8,
          timezone: wrong ? 'Asia/Seoul' : zone,
          periodStartDate: start,
          periodEndDate: day,
          historyStatus: 'partial',
        },
      });
    });
    await page.goto(`/links/${id}`);
    const usage = page.getByRole('region', { name: '사용 빈도' });
    await expect(usage).toContainText('America/New_York');
    await expect(usage).toContainText('기록된 8회');
    expect(zones.every((z) => z === 'America/New_York')).toBe(true);
    wrong = true;
    await page.reload();
    await expect(usage.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('link', { name: '링크 열기', exact: true }),
    ).toBeVisible();
  });
  test('device zone change creates new query and discards the old display', async ({
    page,
  }) => {
    await page.goto(`/links/${fixtureId('chatgpt')}`);
    await expect(page.getByText(/America\/New_York/)).toBeVisible();
    await page.evaluate(() => {
      const Original = Intl.DateTimeFormat;
      Object.defineProperty(Intl, 'DateTimeFormat', {
        value: function (
          locales?: Intl.LocalesArgument,
          options?: Intl.DateTimeFormatOptions,
        ) {
          return new Original(locales, {
            ...options,
            timeZone: options?.timeZone ?? 'Asia/Seoul',
          });
        },
      });
      window.dispatchEvent(new Event('focus'));
    });
    await expect(page.getByRole('region', { name: '사용 빈도' })).toContainText(
      'Asia/Seoul',
    );
    await expect(page.getByText(/America\/New_York/)).toHaveCount(0);
  });
});
