import { expectAccountVerified } from './account-assertions';
import { mkdir } from 'node:fs/promises';
import { test, expect, testUser, authenticate } from './auth-fixture';
import type { Page } from '@playwright/test';
import { fixtureId } from './product-fixture';
import type { CategoryResponse } from '../src/contracts/categories';
import {
  categoryDistribution,
  categoryColor,
} from '../src/features/settings/adapters/category-distribution';
import { accountConnection } from '../src/features/auth/account-connection';
import { expectClearOfNavigation } from './layout-assertions';
const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const category = (name: string, sortOrder = 0): CategoryResponse => ({
  id: fixtureId(name),
  name,
  sortOrder,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
function dataset(counts = [3, 2, 0], unclassified = 1) {
  const categories = counts.map((_, i) =>
    category(i === 0 ? '개발' : i === 1 ? '디자인' : `카테고리 ${i}`, i),
  );
  return {
    categories,
    summary: {
      items: categories.map((item, i) => ({
        id: item.id,
        linkCount: counts[i] ?? 0,
      })),
      uncategorizedCount: unclassified,
      totalLinkCount: counts.reduce((a, b) => a + b, unclassified),
    },
  };
}
async function dataApi(page: Page, data = dataset()) {
  await page.route('**/categories', (route) =>
    route.fulfill({ headers, json: data.categories }),
  );
  await page.route('**/categories/summary', (route) =>
    route.fulfill({ headers, json: data.summary }),
  );
  return data;
}
async function capture(page: Page, name: string) {
  const dir = `artifacts/wo-ui-18/after/${page.context().browser()?.browserType().name()}`;
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}
const center = (page: Page) => page.getByTestId('donut-center');
const list = (page: Page) =>
  page.getByRole('list', { name: '카테고리별 링크 수' });

for (const width of [320, 390, 512, 768, 1024, 1440, 1920]) {
  test(`settings layout and real chart ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' ||
        /width.*height.*greater than|hydration/i.test(message.text())
      )
        errors.push(message.text());
    });
    const calls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes(':54329/'))
        calls.push(new URL(request.url()).pathname);
    });
    await dataApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/settings');
    await expect(center(page)).toHaveText('6전체 링크');
    await expect(page.getByLabel('미사용 링크 추천 기간')).toHaveValue('14');
    await expectAccountVerified(page);
    await expect(page.getByText('집계 연동 예정')).toHaveCount(0);
    await expect(
      page.locator('[aria-label="최근 7일 사용한 링크"]'),
    ).toBeVisible();
    await expect(page.locator('[aria-label="전체 링크"]')).toContainText('6개');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    for (const button of await list(page).getByRole('button').all())
      expect(
        await button.evaluate((el) => parseFloat(getComputedStyle(el).height)),
      ).toBeGreaterThanOrEqual(44);
    expect(
      (await page.getByLabel('미사용 링크 추천 기간').boundingBox())?.height,
    ).toBeGreaterThanOrEqual(48);
    await page
      .getByRole('button', { name: '로그아웃', exact: true })
      .scrollIntoViewIfNeeded();
    await expectClearOfNavigation(
      page,
      page.getByRole('button', { name: '로그아웃', exact: true }),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await capture(page, `settings-${width}`);
    expect(calls.filter((path) => /stats|^\/links/.test(path))).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('adapter preserves totals, UUID colors, ordering and validates snapshots', () => {
  const data = dataset();
  const result = categoryDistribution(data.summary, data.categories);
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') throw new Error('Expected ready');
  expect(result.items.reduce((n, item) => n + item.count, 0)).toBe(6);
  expect(result.items[0]?.percentage).toBe(50);
  expect(result.items.some((item) => item.id === data.categories[2]!.id)).toBe(
    false,
  );
  expect(result.items[2]?.percentage).toBeCloseTo(100 / 6);
  expect(categoryColor(data.categories[0]!.id)).toBe(
    categoryColor(data.categories[0]!.id.toUpperCase()),
  );
  const reordered = categoryDistribution(
    data.summary,
    [...data.categories].reverse().map((item) => ({
      ...item,
      name: '변경',
      sortOrder: 3 - item.sortOrder,
    })),
  );
  expect(reordered.status).toBe('ready');
  if (reordered.status === 'ready')
    expect(
      new Map(reordered.items.map((item) => [item.id, item.color])),
    ).toEqual(new Map(result.items.map((item) => [item.id, item.color])));
  expect(
    categoryDistribution(
      { ...data.summary, totalLinkCount: 99 },
      data.categories,
    ).status,
  ).toBe('invalid');
  expect(
    categoryDistribution(
      {
        ...data.summary,
        items: [...data.summary.items, data.summary.items[0]!],
      },
      data.categories,
    ).status,
  ).toBe('invalid');
  expect(
    categoryDistribution(data.summary, [
      ...data.categories,
      data.categories[0]!,
    ]).status,
  ).toBe('invalid');
  expect(
    categoryDistribution(
      data.summary,
      data.categories.map((item) => ({ ...item, id: 'bad' })),
    ).status,
  ).toBe('invalid');
  expect(
    categoryDistribution(data.summary, data.categories.slice(1)).status,
  ).toBe('mismatch');
});

test('click, hover tooltip, keyboard and reset share selection', async ({
  page,
}) => {
  const data = await dataApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/settings');
  const develop = list(page).getByRole('button', { name: /^개발/ });
  await develop.click();
  await expect(center(page)).toHaveText('3개발50.0%');
  await expect(develop).toHaveAttribute('aria-pressed', 'true');
  await capture(page, 'selected');
  const design = page.locator(
    `path[data-category-id="${data.categories[1]!.id}"]`,
  );
  await design.scrollIntoViewIfNeeded();
  const chart = await page.getByTestId('donut').boundingBox();
  if (!chart) throw new Error('Chart bounds required');
  // The sector bounding box center lies in the donut hole. Use its painted mid-angle (240 degrees).
  const point = {
    x: chart.x + chart.width / 2 - 54,
    y: chart.y + chart.height / 2 + 94,
  };
  await page.mouse.move(point.x, point.y);
  await expect(page.getByRole('tooltip')).toContainText('디자인 · 2개 · 33.3%');
  await expect(center(page)).toHaveText('3개발50.0%');
  await capture(page, 'hover-tooltip');
  await page.mouse.click(point.x, point.y);
  await expect(center(page)).toHaveText('2디자인33.3%');
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  await expect(center(page)).toHaveText('6전체 링크');
  await develop.focus();
  await page.keyboard.press('Enter');
  await expect(center(page)).toHaveText('3개발50.0%');
  await page.keyboard.press('Space');
  await expect(center(page)).toHaveText('6전체 링크');
  await expect(
    list(page).getByRole('button', { name: /^카테고리 2/ }),
  ).toHaveCount(0);
  await expect(
    page.locator(`path[data-category-id="${data.categories[2]!.id}"]`),
  ).toHaveCount(0);
});

for (const [name, counts, unclassified] of [
  ['zero', [0, 0], 0],
  ['one', [1], 0],
  ['uncategorized', [], 4],
  ['no-categories', [], 0],
] as const) {
  test(`distribution ${name}`, async ({ page }) => {
    const data = await dataApi(page, dataset([...counts], unclassified));
    await page.goto('/settings');
    await expect(center(page)).toHaveText(
      `${data.summary.totalLinkCount}전체 링크`,
    );
    await expect(page.locator('path[data-category-id]')).toHaveCount(
      counts.filter((n) => n > 0).length + (unclassified > 0 ? 1 : 0),
    );
    await expect(list(page).getByRole('button')).toHaveCount(
      counts.filter((n) => n > 0).length + Number(unclassified > 0),
    );
    await capture(page, name);
  });
}

test('many categories and long account/category names at 320px', async ({
  page,
}) => {
  const data = dataset(Array.from({ length: 30 }, () => 1));
  data.categories[0]!.name = '매우 긴 카테고리 이름 '.repeat(15);
  await dataApi(page, data);
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({
      json: { ...testUser, email: 'long'.repeat(30) + '@example.test' },
    }),
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/settings');
  await expect(list(page).getByRole('button')).toHaveCount(6);
  await list(page).getByRole('button').first().click();
  await expect(center(page)).toContainText(data.categories[0]!.name);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await capture(page, 'long-320');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(list(page)).toHaveCSS('overflow-y', 'visible');
  expect((await list(page).boundingBox())?.height).toBeLessThanOrEqual(320);
  await capture(page, 'many-categories');
});

test('mobile touch selects and resets', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  await authenticate(context);
  const page = await context.newPage();
  await dataApi(page);
  await page.goto('http://localhost:3100/settings');
  await list(page).getByRole('button').first().tap();
  await expect(center(page)).toHaveText('3개발50.0%');
  await list(page).getByRole('button').first().tap();
  await expect(center(page)).toHaveText('6전체 링크');
  await context.close();
});

test('mismatched snapshots wait and retry, malformed sum never renders', async ({
  page,
}) => {
  const data = dataset();
  const categories = [...data.categories];
  data.categories = categories.slice(1);
  await dataApi(page, data);
  await page.goto('/settings');
  await expect(
    page.getByText(
      '카테고리 정보가 변경되었어요. 최신 정보를 다시 불러와 주세요.',
    ),
  ).toBeVisible();
  await expect(center(page)).toHaveCount(0);
  data.categories = categories;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(center(page)).toHaveText('6전체 링크');
  data.summary.totalLinkCount = 8;
  await page.reload();
  await expect(
    page.getByText('전체 링크 수를 불러오지 못했어요.'),
  ).toBeVisible();
  await expect(center(page)).toHaveCount(0);
});

test('summary loading, error and retry are distinct from unavailable metrics', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await dataApi(page);
  await page.route('**/categories/summary', async (route) => {
    await gate;
    await route.fulfill({ status: 500, headers, json: {} });
  });
  await page.goto('/settings');
  await expect(page.getByText('링크 분포를 불러오는 중…')).toBeVisible();
  await expect(page.getByText('집계 연동 예정')).toHaveCount(0);
  await expect(
    page.locator('[aria-label="최근 7일 사용한 링크"]'),
  ).toBeVisible();
  await capture(page, 'loading');
  release();
  await expect(
    page.getByText('전체 링크 수를 불러오지 못했어요.'),
  ).toBeVisible();
  await expect(page.locator('[aria-label="전체 링크"]')).toContainText(
    '조회 실패',
  );
  await dataApi(page);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(center(page)).toHaveText('6전체 링크');
});

test('category metadata error and retry retain account/preferences', async ({
  page,
}) => {
  await dataApi(page);
  await page.route('**/categories', (route) =>
    route.fulfill({ status: 500, headers, json: {} }),
  );
  await page.goto('/settings');
  await expect(page.getByText('카테고리를 불러오지 못했어요.')).toBeVisible();
  await expect(page.getByLabel('미사용 링크 추천 기간')).toBeEnabled();
  await expect(page.getByText(testUser.email)).toBeVisible();
  await dataApi(page);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(center(page)).toHaveText('6전체 링크');
});

test('verified account switch discards chart selection and previous counts', async ({
  page,
  context,
}) => {
  const data = await dataApi(page);
  await page.goto('/settings');
  await list(page).getByRole('button').first().click();
  await expect(center(page)).toHaveText('3개발50.0%');
  data.summary.items.forEach((item) => {
    item.linkCount = 0;
  });
  data.summary.uncategorizedCount = 0;
  data.summary.totalLinkCount = 0;
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('second@example.test')).toBeVisible();
  await expect(center(page)).toHaveText('0전체 링크');
  await expect(list(page).locator('[aria-pressed="true"]')).toHaveCount(0);
});

for (const [name, metadata, expected] of [
  ['google', { provider: 'google' }, 'Google'],
  ['email', { provider: 'email' }, '이메일'],
  [
    'multiple',
    { provider: 'google', providers: ['google', 'email'] },
    '복수 연결',
  ],
  ['unknown', {}, null],
] as const) {
  test(`account provider ${name} and absent profile`, async ({ page }) => {
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({
        json: {
          ...testUser,
          email: undefined,
          user_metadata: {},
          app_metadata: metadata,
        },
      }),
    );
    await page.goto('/settings');
    await expect(page.getByText('내 계정', { exact: true })).toBeVisible();
    await expect(page.getByText(testUser.email)).toHaveCount(0);
    if (expected)
      await expect(page.getByLabel('계정 연결 수단')).toHaveText(expected);
    else await expect(page.getByLabel('계정 연결 수단')).toHaveCount(0);
  });
}

test('identity list overrides representative provider', () => {
  const identity = (provider: string) => ({
    id: provider,
    identity_id: provider,
    user_id: testUser.id,
    provider,
    created_at: testUser.created_at,
    updated_at: testUser.created_at,
  });
  expect(
    accountConnection({ ...testUser, identities: [identity('email')] }),
  ).toBe('이메일');
  expect(
    accountConnection({
      ...testUser,
      identities: [identity('email'), identity('google')],
    }),
  ).toBe('복수 연결');
  expect(
    accountConnection({ ...testUser, identities: [identity('unknown')] }),
  ).toBeNull();
});

test('avatar failure and account API error preserve usable settings', async ({
  page,
}) => {
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({
      json: {
        ...testUser,
        user_metadata: {
          name: '이름',
          avatar_url: 'https://avatar.example.test/broken.png',
        },
      },
    }),
  );
  await page.route('https://avatar.example.test/broken.png', (route) =>
    route.abort(),
  );
  await page.route('**/auth/me', (route) =>
    route.fulfill({ status: 500, headers, json: {} }),
  );
  await page.goto('/settings');
  await expect(
    page.getByRole('region', { name: '계정', exact: true }).locator('img'),
  ).toHaveCount(0);
  await expect(page.getByText('이름', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '다시 시도', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('미사용 링크 추천 기간')).toBeEnabled();
  await capture(page, 'account-error');
  await page.unroute('**/auth/me');
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expectAccountVerified(page);
});

test('preferences saving/failure screenshots and bottom actions', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/users/me/preferences', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    await gate;
    await route.fulfill({ status: 500, headers, json: {} });
  });
  await page.goto('/settings');
  const select = page.getByLabel('미사용 링크 추천 기간');
  await expect(select).toHaveValue('14');
  await select.selectOption('7');
  await expect(select).toBeDisabled();
  await expect(page.getByText('저장 중…')).toBeVisible();
  await capture(page, 'preferences-saving');
  release();
  await expect(select).toBeEnabled();
  await expect(
    page.getByRole('region', { name: '링크 관리 설정' }).getByRole('alert'),
  ).toBeVisible();
  await capture(page, 'preferences-failed');
  await page.unroute('**/users/me/preferences');
  await select.selectOption('7');
  await expect(page.getByText('저장했어요.')).toBeVisible();
  await expect(select).toHaveValue('7');
  await expect(
    page.getByRole('link', { name: 'API 연결 진단', exact: true }),
  ).toHaveCount(0);
  const logout = page.getByRole('button', { name: '로그아웃', exact: true });
  expect((await logout.boundingBox())!.y).toBeGreaterThan(
    (await page.getByRole('region', { name: '링크 관리 설정' }).boundingBox())!
      .y,
  );
  await capture(page, 'bottom-actions');
  await page.goto('/diagnostics');
  await expect(
    page.getByRole('heading', { name: 'Foundation 상태' }),
  ).toBeVisible();
});

test('background reconnect refresh preserves selection through rename/order, then clears deletion', async ({
  page,
}) => {
  const data = await dataApi(page);
  await page.clock.install();
  await page.goto('/settings');
  await list(page).getByRole('button').first().click();
  await expect(center(page)).toHaveText('3개발50.0%');
  const id = data.categories[0]!.id;
  const originalFill = await page
    .locator(`path[data-category-id="${id}"]`)
    .getAttribute('fill');
  async function refresh() {
    await page.clock.fastForward(16000);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
  }
  data.categories[0]!.name = '새 개발';
  data.categories[0]!.sortOrder = 10;
  data.summary.items[0]!.linkCount = 4;
  data.summary.totalLinkCount = 7;
  await refresh();
  await expect(center(page)).toHaveText('4새 개발57.1%');
  await expect(page.locator('[aria-label="전체 링크"]')).toContainText('7개');
  expect(
    await page.locator(`path[data-category-id="${id}"]`).getAttribute('fill'),
  ).toBe(originalFill);
  await expect(list(page).getByRole('button').first()).toContainText('새 개발');
  // A background failure must not replace confirmed chart/count data with zeros.
  await page.route('**/categories/summary', (route) =>
    route.fulfill({ status: 500, headers, json: {} }),
  );
  await refresh();
  await expect(
    page.getByText('전체 링크 수를 불러오지 못했어요.'),
  ).toBeVisible();
  await expect(center(page)).toHaveText('4새 개발57.1%');
  data.categories = data.categories.filter((item) => item.id !== id);
  data.summary.items = data.summary.items.filter((item) => item.id !== id);
  data.summary.uncategorizedCount = 5;
  await dataApi(page, data);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  // Reconnect refetches both independent queries; wait for their settled snapshot.
  await refresh();
  await expect(center(page)).toHaveText('7전체 링크');
  await expect(list(page).locator('[aria-pressed="true"]')).toHaveCount(0);
});

test('logout pending prevents duplicate requests and keeps local scope', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route('**/auth/v1/logout*', async (route) => {
    calls++;
    expect(new URL(route.request().url()).searchParams.get('scope')).toBe(
      'local',
    );
    await gate;
    await route.fulfill({ status: 204 });
  });
  await page.goto('/settings');
  const logout = page.getByRole('button', { name: '로그아웃', exact: true });
  await logout.click();
  await expect(logout).toBeDisabled();
  await logout.dispatchEvent('click');
  expect(calls).toBe(1);
  release();
  await expect(page).toHaveURL('/login');
});
