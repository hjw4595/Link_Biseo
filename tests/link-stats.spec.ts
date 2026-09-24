import { editLinkInfo } from './link-actions-helper';
import type { Page } from '@playwright/test';
import {
  test,
  expect,
  authenticate,
  testSession,
  testUser,
} from './auth-fixture';
import { fixtureId, initialProduct } from './product-fixture';
import {
  isLinkStatsResponse,
  type LinkStatsResponse,
} from '../src/contracts/link-stats';
import {
  seoulDate,
  previousDate,
  usageDateLabel,
} from '../src/features/links/usage-date';

test.use({ timezoneId: 'Asia/Seoul' });

const id = fixtureId('chatgpt');
const api = `http://127.0.0.1:54329/links/${id}`;
const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const now = '2026-10-15T04:00:00.000Z';
async function statsApi(page: Page) {
  const link = initialProduct().links.find((link) => link.id === id);
  if (!link) throw new Error('Missing link fixture');
  const stats: LinkStatsResponse = {
    linkId: id,
    createdAt: '2026-10-14T15:30:00.000Z',
    lastOpenedAt: null,
    recent7DayOpenCount: 0,
    timezone: 'Asia/Seoul',
    periodStartDate: '2026-10-09',
    periodEndDate: '2026-10-15',
    historyStatus: 'complete',
  };
  const state = {
    link: {
      ...link,
      createdAt: stats.createdAt,
      lastOpenedAt: null as string | null,
    },
    stats,
    reads: 0,
    fail: false,
    malformed: false,
    gate: undefined as Promise<void> | undefined,
  };
  await page.clock.install({ time: new Date(now) });
  await page.route(api, (route) =>
    route.fulfill({ headers, json: state.link }),
  );
  await page.route(`${api}/stats?*`, async (route) => {
    state.reads++;
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    await state.gate;
    await route.fulfill({
      headers,
      status: state.fail ? 503 : 200,
      json: state.fail
        ? {}
        : state.malformed
          ? { ...state.stats, recent7DayOpenCount: -1 }
          : { ...state.stats, lastOpenedAt: state.link.lastOpenedAt },
    });
  });
  return state;
}

test('stats contract rejects malformed counts, wrong timezone and invalid calendar ranges', () => {
  const valid = {
    linkId: id,
    createdAt: now,
    lastOpenedAt: null,
    recent7DayOpenCount: 12,
    timezone: 'Asia/Seoul',
    periodStartDate: '2026-10-09',
    periodEndDate: '2026-10-15',
    historyStatus: 'complete',
  };
  expect(isLinkStatsResponse(valid)).toBe(true);
  for (const bad of [
    null,
    {},
    { ...valid, recent7DayOpenCount: -1 },
    { ...valid, recent7DayOpenCount: 1.5 },
    { ...valid, recent7DayOpenCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, timezone: 'Invalid/Zone' },
    { ...valid, periodStartDate: '2026-10-08' },
    { ...valid, periodEndDate: '2026-02-30' },
    { ...valid, createdAt: 'invalid' },
    { ...valid, historyStatus: 'unknown' },
    { ...valid, linkId: 'bad' },
  ])
    expect(isLinkStatsResponse(bad)).toBe(false);
});

test('relative usage dates follow KST calendar midnight, month/year/leap boundaries', () => {
  expect(seoulDate('2026-10-15T14:59:59.999Z')).toBe('2026-10-15');
  expect(seoulDate('2026-10-15T15:00:00.000Z')).toBe('2026-10-16');
  expect(usageDateLabel('2026-10-15T14:50:00.000Z', '2026-10-16')).toBe('어제');
  expect(usageDateLabel('2026-10-15T15:00:00.000Z', '2026-10-16')).toBe('오늘');
  expect(usageDateLabel(null, '2026-10-16')).toBe('사용 기록 없음');
  expect(usageDateLabel('2026-10-01T00:00:00.000Z', '2026-10-16')).toBe(
    '2026.10.01',
  );
  expect(previousDate('2026-11-01')).toBe('2026-10-31');
  expect(previousDate('2027-01-01')).toBe('2026-12-31');
  expect(previousDate('2028-03-01')).toBe('2028-02-29');
});

for (const count of [0, 1, 12, 1234]) {
  test(`stats shows ${count} recent opens without a lifetime metric`, async ({
    page,
  }) => {
    const state = await statsApi(page);
    state.stats.recent7DayOpenCount = count;
    await page.goto(`/links/${id}`);
    await expect(page.getByRole('region', { name: '사용 빈도' })).toContainText(
      `${count.toLocaleString('ko-KR')}회 열었어요`,
    );
    await expect(page.getByText('2026.10.15', { exact: true })).toBeVisible();
    await expect(
      page.getByText('사용 기록 없음', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('방문 횟수', { exact: true })).toHaveCount(0);
  });
}

for (const [stamp, label] of [
  [now, '오늘'],
  ['2026-10-14T14:50:00.000Z', '어제'],
  ['2026-10-01T15:00:00.000Z', '2026.10.02'],
] as const) {
  test(`detail recent usage label ${label}`, async ({ page }) => {
    const state = await statsApi(page);
    state.link.lastOpenedAt = stamp;
    await page.goto(`/links/${id}`);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  });
}

test('stats loading, error, invalid responses and retry do not block link controls', async ({
  page,
}) => {
  const state = await statsApi(page);
  let release = () => {};
  state.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.goto(`/links/${id}`);
  await expect(page.getByText('사용 통계를 불러오고 있어요.')).toBeVisible();
  await expect(
    page.getByRole('link', { name: '링크 열기', exact: true }),
  ).toBeEnabled();
  state.fail = true;
  release();
  const usage = page.getByRole('region', { name: '사용 빈도' });
  await expect(usage.getByRole('alert')).toContainText(
    '사용 통계를 불러오지 못했어요.',
  );
  await editLinkInfo(page);
  await expect(page.getByLabel('제목', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '삭제', exact: true }),
  ).toBeEnabled();
  state.fail = false;
  state.malformed = true;
  await usage.getByRole('button', { name: '다시 시도' }).click();
  await expect.poll(() => state.reads).toBe(2);
  await expect(usage.getByRole('alert')).toBeVisible();
  state.malformed = false;
  await usage.getByRole('button', { name: '다시 시도' }).click();
  await expect(usage).toContainText('0회 열었어요');
});

test('partial history never presents an unqualified zero', async ({ page }) => {
  const state = await statsApi(page);
  state.stats.historyStatus = 'partial';
  await page.goto(`/links/${id}`);
  const usage = page.getByRole('region', { name: '사용 빈도' });
  await expect(usage).toContainText('기록된 0회 열었어요');
  await expect(usage.getByRole('status')).toContainText(
    '이전 사용 기록이 일부 없어',
  );
  await page.screenshot({
    path: 'artifacts/wo-006/screenshots/partial.png',
    animations: 'disabled',
  });
});

test('an open refreshes stats, survives reload, and a stats failure leaves opening usable', async ({
  page,
  context,
}) => {
  const state = await statsApi(page);
  state.link.url = 'https://example.test/open';
  await context.route('https://example.test/open', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Opened</h1>' }),
  );
  await page.route(`${api}/open`, (route) => {
    state.stats.recent7DayOpenCount++;
    state.link.lastOpenedAt = now;
    return route.fulfill({
      headers,
      json: { url: 'https://example.test/open', openedAt: now },
    });
  });
  await page.goto(`/links/${id}`);
  const usage = page.getByRole('region', { name: '사용 빈도' });
  await expect(usage).toContainText('0회 열었어요');
  const popup = context.waitForEvent('page');
  await page.getByRole('link', { name: '새 탭에서 열기', exact: true }).click();
  await (await popup).close();
  await expect(usage).toContainText('1회 열었어요');
  await expect(page.getByText('오늘', { exact: true })).toBeVisible();
  await page.reload();
  await expect(usage).toContainText('1회 열었어요');
  state.fail = true;
  await page.reload();
  await expect(usage.getByRole('alert')).toBeVisible();
  const nextPopup = context.waitForEvent('page');
  await page.getByRole('link', { name: '새 탭에서 열기', exact: true }).click();
  const opened = await nextPopup;
  await expect(opened).toHaveURL('https://example.test/open');
  await opened.close();
  expect(state.stats.recent7DayOpenCount).toBe(2);
});

test('KST midnight changes the query day and relative date without interval polling', async ({
  page,
  context,
}) => {
  const state = await statsApi(page);
  // This clock moves hours ahead of the test server. Keep this test's fake JWT
  // valid on both clocks so it exercises midnight, not an auth-refresh loop.
  const session = testSession();
  const expires =
    Math.floor(
      Math.max(Date.now(), Date.parse('2026-10-16T00:00:00Z')) / 1000,
    ) + 86_400;
  session.expires_at = expires;
  session.expires_in = 86_400;
  session.access_token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(
      JSON.stringify({
        sub: testUser.id,
        exp: expires,
        aud: 'authenticated',
        kind: 'valid',
      }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value:
        'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ]);
  await page.clock.setFixedTime(new Date('2026-10-15T14:59:59.000Z'));
  state.link.lastOpenedAt = '2026-10-15T14:50:00.000Z';
  state.stats.recent7DayOpenCount = 12;
  await page.goto(`/links/${id}`);
  await expect(page.getByRole('region', { name: '사용 빈도' })).toContainText(
    '12회 열었어요',
  );
  await expect(page.getByText('오늘', { exact: true })).toBeVisible();
  state.stats.periodEndDate = '2026-10-16';
  state.stats.periodStartDate = '2026-10-10';
  state.stats.recent7DayOpenCount = 3;
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00.100Z'));
  await page.clock.fastForward(1100);
  await expect(page.getByRole('region', { name: '사용 빈도' })).toContainText(
    '3회 열었어요',
  );
  await expect(page.getByText('어제', { exact: true })).toBeVisible();
  const reads = state.reads;
  await page.clock.fastForward(60_000);
  expect(state.reads).toBe(reads);
});

test('late previous-user stats cannot replace the new account cache', async ({
  page,
  context,
}) => {
  await statsApi(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route(`${api}/stats?*`, async (route) => {
    const first = ++calls === 1;
    if (first) await gate;
    await route.fulfill({
      headers,
      json: {
        linkId: id,
        createdAt: now,
        lastOpenedAt: null,
        recent7DayOpenCount: first ? 11 : 7,
        timezone: 'Asia/Seoul',
        periodStartDate: '2026-10-09',
        periodEndDate: '2026-10-15',
        historyStatus: 'complete',
      },
    });
  });
  await page.goto(`/links/${id}`);
  await expect.poll(() => calls).toBe(1);
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('region', { name: '사용 빈도' })).toContainText(
    '7회 열었어요',
  );
  release();
  await expect(
    page.getByRole('region', { name: '사용 빈도' }),
  ).not.toContainText('11회');
});

for (const width of [320, 375, 390, 430, 512, 1440]) {
  test(`usage detail fits ${width}px and large counts`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const state = await statsApi(page);
    state.stats.recent7DayOpenCount = 1234567890;
    await page.goto(`/links/${id}`);
    const usage = page.getByRole('region', { name: '사용 빈도' });
    await expect(usage).toContainText('1,234,567,890회 열었어요');
    await usage.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await usage.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/wo-006/screenshots/detail-${width}.png`,
      animations: 'disabled',
    });
  });
}
