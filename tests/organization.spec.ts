import { registerLink } from './link-filter-helper';
import { categoryMenu } from './category-ui';
import { editLinkInfo, requestLinkDeletion } from './link-actions-helper';
import { expectLayoutWidth } from './layout-assertions';
import {
  test,
  expect,
  authenticate,
  testUser,
  testSession,
} from './auth-fixture';
import { fixtureId } from './product-fixture';
import {
  installOrganizationApi,
  organizationReport,
  organizationState,
} from './organization-fixture';
import {
  isOrganizationReport,
  normalizeOrganizationTimeZone,
} from '../src/contracts/organization-report';
import { reportToRecommendations } from '../src/features/organization/adapters/report-to-recommendations';
import { recommendationPolicy } from '../src/features/organization/recommendation-policy';
import { QueryClient, QueryObserver, skipToken } from '@tanstack/react-query';
import {
  markOrganizationReportsStale,
  organizationRevision,
  type CachedOrganizationReport,
} from '../src/lib/query/organization';
import { queryKeys } from '../src/lib/query/keys';
import { safeNext } from '../src/features/auth/redirect';
import type { Page } from '@playwright/test';

const path = '/assistant/organization';
const stamp = (page: Page) => page.locator('time');
async function run(page: Page) {
  await page.goto(path + '?action=run');
  await expect(stamp(page)).toBeVisible();
  await expect(page).toHaveURL(path);
}
test('contract accepts normal, empty links/categories, Off, nullable fields and >10 categories', () => {
  expect(isOrganizationReport(organizationReport())).toBe(true);
  const state = organizationState();
  state.links = [];
  expect(isOrganizationReport(organizationReport(state))).toBe(true);
  state.categories = [];
  expect(isOrganizationReport(organizationReport(state))).toBe(true);
  state.links = organizationState().links.map((link) => ({
    ...link,
    categoryId: null,
  }));
  expect(isOrganizationReport(organizationReport(state))).toBe(true);
  state.cleanupThresholdDays = null;
  const off = organizationReport(state);
  expect(isOrganizationReport(off)).toBe(true);
  expect(off.cleanupCandidates).toMatchObject({
    totalCount: 0,
    items: [],
    truncated: false,
    thresholdDays: null,
  });
  state.categories = Array.from({ length: 15 }, (_, index) => ({
    ...organizationState().categories[0]!,
    id: fixtureId(`empty-cat-${index}`),
  }));
  expect(isOrganizationReport(organizationReport(state))).toBe(true);
  expect(off.recentlyAdded.totalCount).toBe(off.summary.totalLinks);
});
const base = () => organizationReport();
const invalid: [string, () => unknown][] = [
  ['object', () => null],
  ['array', () => []],
  [
    'negative total',
    () => ({ ...base(), summary: { ...base().summary, totalLinks: -1 } }),
  ],
  [
    'fractional count',
    () => ({ ...base(), summary: { ...base().summary, totalCategories: 1.1 } }),
  ],
  [
    'unsafe integer',
    () => ({
      ...base(),
      summary: { ...base().summary, totalLinks: Number.MAX_SAFE_INTEGER + 1 },
    }),
  ],
  ['category total mismatch', () => ({ ...base(), categories: [] })],
  [
    'category sum mismatch',
    () => ({
      ...base(),
      categories: base().categories.map((c) => ({ ...c, linkCount: 0 })),
    }),
  ],
  [
    'category UUID',
    () => ({ ...base(), categories: [{ ...base().categories[0], id: 'bad' }] }),
  ],
  [
    'link UUID',
    () => ({
      ...base(),
      uncategorized: {
        ...base().uncategorized,
        items: [{ ...base().uncategorized.items[0], id: 'bad' }],
      },
    }),
  ],
  [
    'link category UUID',
    () => ({
      ...base(),
      uncategorized: {
        ...base().uncategorized,
        items: [{ ...base().uncategorized.items[0], categoryId: 'bad' }],
      },
    }),
  ],
  [
    'unknown owned category',
    () => ({
      ...base(),
      recentlyAdded: {
        ...base().recentlyAdded,
        items: [
          {
            ...base().recentlyAdded.items[0],
            categoryId: fixtureId('missing'),
          },
        ],
      },
    }),
  ],
  [
    'missing LinkResponse field',
    () => ({
      ...base(),
      recentlyAdded: {
        ...base().recentlyAdded,
        items: [{ id: fixtureId('react') }],
      },
    }),
  ],
  [
    'nonnullable link count',
    () => ({
      ...base(),
      recentlyAdded: {
        ...base().recentlyAdded,
        items: [{ ...base().recentlyAdded.items[0], clickCount: null }],
      },
    }),
  ],
  ['asOf ISO precision', () => ({ ...base(), asOf: '2026-10-23T00:00:00Z' })],
  [
    'invalid calendar date',
    () => ({
      ...base(),
      cleanupCandidates: {
        ...base().cleanupCandidates,
        asOfDate: '2026-02-30',
      },
    }),
  ],
  ['offset zone', () => ({ ...base(), timeZone: '+09:00' })],
  ['unknown zone', () => ({ ...base(), timeZone: 'Wrong/Unknown' })],
  ['semantics enum', () => ({ ...base(), semantics: { status: 'ready' } })],
  [
    'cleanup enum',
    () => ({
      ...base(),
      cleanupCandidates: { ...base().cleanupCandidates, thresholdDays: 15 },
    }),
  ],
  [
    'unused days',
    () => ({
      ...base(),
      cleanupCandidates: {
        ...base().cleanupCandidates,
        items: [{ ...base().cleanupCandidates.items[0], unusedDays: -1 }],
      },
    }),
  ],
  [
    'favorite cleanup candidate',
    () => ({
      ...base(),
      cleanupCandidates: {
        ...base().cleanupCandidates,
        items: [{ ...base().cleanupCandidates.items[0], isFavorite: true }],
      },
    }),
  ],
  [
    'Off with candidates',
    () => ({
      ...base(),
      cleanupCandidates: { ...base().cleanupCandidates, thresholdDays: null },
    }),
  ],
  [
    'uncategorized summary',
    () => ({
      ...base(),
      uncategorized: { ...base().uncategorized, totalCount: 0 },
    }),
  ],
  [
    'cleanup summary',
    () => ({
      ...base(),
      cleanupCandidates: { ...base().cleanupCandidates, totalCount: 0 },
    }),
  ],
  [
    'metadata summary',
    () => ({
      ...base(),
      metadataFailures: { ...base().metadataFailures, totalCount: 0 },
    }),
  ],
  [
    'recently total',
    () => ({
      ...base(),
      recentlyAdded: { ...base().recentlyAdded, totalCount: 0 },
    }),
  ],
  [
    'truncated type',
    () => ({
      ...base(),
      recentlyAdded: { ...base().recentlyAdded, truncated: 'false' },
    }),
  ],
  [
    'truncated coherence',
    () => ({
      ...base(),
      recentlyAdded: { ...base().recentlyAdded, truncated: true },
    }),
  ],
  [
    'section over 10',
    () => ({
      ...base(),
      recentlyAdded: {
        ...base().recentlyAdded,
        items: Array.from({ length: 11 }, () => base().recentlyAdded.items[0]),
      },
    }),
  ],
];
for (const [name, value] of invalid)
  test(`contract rejects ${name}`, () =>
    expect(isOrganizationReport(value())).toBe(false));

test('adapter preserves counts, limits, order/add/remove and snapshot Off', () => {
  const report = base();
  const items = reportToRecommendations(report);
  expect(items.map((item) => item.kind)).toEqual([
    'uncategorized_links',
    'unused_links',
    'metadata_failures',
  ]);
  expect(items[1]).toMatchObject({
    count: report.cleanupCandidates.totalCount,
    returnedCount: report.cleanupCandidates.items.length,
  });
  expect(items[1]!.previewItems.length).toBeLessThanOrEqual(3);
  expect(
    reportToRecommendations(
      report,
      [...recommendationPolicy]
        .reverse()
        .map((rule, priority) => ({ ...rule, priority })),
    )[0]!.kind,
  ).toBe('metadata_failures');
  expect(
    reportToRecommendations(report, recommendationPolicy.slice(1)),
  ).toHaveLength(2);
  expect(
    reportToRecommendations(report, [
      ...recommendationPolicy,
      { ...recommendationPolicy[0]!, kind: 'new_rule', priority: 40 },
    ]),
  ).toHaveLength(4);
  const state = organizationState();
  state.cleanupThresholdDays = null;
  expect(
    reportToRecommendations(organizationReport(state)).map((item) => item.kind),
  ).toEqual(['uncategorized_links', 'metadata_failures']);
  state.links = [];
  expect(reportToRecommendations(organizationReport(state))).toEqual([]);
});

test('stale marking touches all zones for A, preserves snapshots, never refetches and isolates B', async () => {
  const cache = new QueryClient();
  const report = base();
  for (const zone of ['UTC', 'Asia/Seoul'])
    cache.setQueryData<CachedOrganizationReport>(
      queryKeys.organizationReport('A', zone),
      { report, stale: false, revision: 0 },
    );
  cache.setQueryData<CachedOrganizationReport>(
    queryKeys.organizationReport('B', 'UTC'),
    { report, stale: false, revision: 0 },
  );
  const observer = new QueryObserver(cache, {
    queryKey: queryKeys.organizationReport('A', 'UTC'),
    queryFn: skipToken,
  });
  const unsubscribe = observer.subscribe(() => {});
  markOrganizationReportsStale(cache, 'A');
  await cache.invalidateQueries({
    queryKey: queryKeys.organizationReports('A'),
  });
  expect(organizationRevision(cache, 'A')).toBe(1);
  for (const zone of ['UTC', 'Asia/Seoul'])
    expect(cache.getQueryData(queryKeys.organizationReport('A', zone))).toEqual(
      { report, stale: true, revision: 0 },
    );
  expect(
    cache.getQueryData<CachedOrganizationReport>(
      queryKeys.organizationReport('B', 'UTC'),
    )?.stale,
  ).toBe(false);
  unsubscribe();
  cache.clear();
});

test('Home favorites and categories have no report calls; direct mount/focus is explicit only', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: '카테고리', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: '링크 추가', exact: true }),
  ).toHaveAttribute('href', '/links/new');
  await expect(
    page
      .getByRole('region', { name: '즐겨찾기', exact: true })
      .getByTestId('link-item'),
  ).toHaveCount(3);
  await expect(
    page.getByRole('region', { name: '미사용 링크 정리' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link'),
  ).toHaveText(['LINK BISEO', '홈', '카테고리', '내 링크', '설정']);
  await expect(
    page.getByRole('button', { name: '비서의 추천', exact: true }),
  ).toBeVisible();
  expect(api.requests).toHaveLength(1);
  expect(
    api.productRequests.filter((request) => /\/links\?/.test(request.url())),
  ).toHaveLength(1);
  const homeRequest = api.productRequests.find(
    (request) => new URL(request.url()).pathname === '/links',
  );
  expect(new URL(homeRequest!.url()).searchParams.get('favorite')).toBe('true');
  expect(new URL(homeRequest!.url()).searchParams.get('limit')).toBe('6');
  await expect(page.getByRole('link', { name: /비서의 추천/ })).toHaveCount(0);
  await page.goto(path);
  await expect(page.getByText('원할 때 추천을 확인하세요')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(api.requests).toHaveLength(1);
  await expect(page.getByText(/예시 데이터/)).toHaveCount(0);
});

test('My links entry has no POST; explicit analysis once with Bearer, canonical zone, Back/Forward/reload no replay', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '비서의 추천', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '비서의 추천', exact: true }).click();
  await page.getByRole('link', { name: '전체 보고서', exact: true }).click();
  await expect(page).toHaveURL(path);
  expect(api.requests).toHaveLength(1);
  await expect(
    page
      .getByRole('navigation')
      .getByRole('link', { name: '내 링크', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: '다시 분석', exact: true }).click();
  await expect(stamp(page)).toBeVisible();
  await expect(page).toHaveURL(path);
  expect(api.requests).toHaveLength(2);
  const request = api.requests[1]!;
  expect(request.method()).toBe('POST');
  expect(new URL(request.url()).search).toBe('');
  expect(request.postDataJSON()).toEqual({
    timeZone: await page.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  });
  expect(request.headers().authorization).toMatch(/^Bearer /);
  const section = page.getByRole('region', { name: '오래 사용하지 않은 링크' });
  await expect(section).toContainText('14일');
  await expect(section.getByRole('button')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await section.getByRole('button').focus();
  await page.keyboard.press('Space');
  await expect(section.getByRole('link')).toHaveCount(3);
  await section.getByRole('button').click();
  await expect(section.getByRole('link')).toHaveCount(0);
  const original = await stamp(page).getAttribute('datetime');
  await page.goBack();
  await expect(page).toHaveURL('/');
  await page.goForward();
  await expect(stamp(page)).toHaveAttribute('datetime', original!);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(api.requests).toHaveLength(2);
  await page.getByRole('button', { name: '다시 분석', exact: true }).click();
  await expect.poll(() => api.requests.length).toBe(3);
  await expect(
    page.getByRole('button', { name: '다시 분석', exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.getByText('원할 때 추천을 확인하세요')).toBeVisible();
  expect(api.requests).toHaveLength(3);
  expect(api.modelRequests).toHaveLength(0);
  expect(
    api.productRequests.filter((request) => request.method() !== 'GET'),
  ).toHaveLength(0);
});

test('pending duplicate lock survives remount and previous snapshot remains while reanalyzing', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  await run(page);
  const initial = await stamp(page).getAttribute('datetime');
  let release = () => {};
  api.control.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.getByRole('button', { name: '다시 분석', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '분석 중', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '분석 중', exact: true })
    .evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  await expect(stamp(page)).toHaveAttribute('datetime', initial!);
  await page.getByRole('link', { name: '뒤로 가기' }).click();
  await expect(page).toHaveURL('/links');
  await page.goBack();
  await expect(
    page.getByRole('button', { name: '분석 중', exact: true }),
  ).toBeDisabled();
  expect(api.requests).toHaveLength(2);
  release();
  await expect(
    page.getByRole('button', { name: '다시 분석', exact: true }),
  ).toBeEnabled();
  expect(api.requests).toHaveLength(2);
});

for (const status of [400, 401, 403, 500, 503])
  test(`HTTP ${status} preserves dated results, no internal error or automatic POST`, async ({
    page,
    context,
  }) => {
    const api = await installOrganizationApi(context);
    await run(page);
    const initial = await stamp(page).getAttribute('datetime');
    api.control.status = status;
    await page.getByRole('button', { name: '다시 분석', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(stamp(page)).toHaveAttribute('datetime', initial!);
    await expect(page.getByText(/이전 결과를 표시/)).toBeVisible();
    await expect(
      page.getByText('INTERNAL_PRIVATE_ERROR_DO_NOT_DISPLAY'),
    ).toHaveCount(0);
    expect(api.requests).toHaveLength(status === 401 ? 3 : 2); // Existing guarded 401 refresh only.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    expect(api.requests).toHaveLength(status === 401 ? 3 : 2);
    api.control.status = 200;
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  });

test('malformed/partial/network responses never become Mock or successful empty results', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  api.control.body = (report) => ({
    ...report,
    metadataFailures: { status: 'unavailable' },
  });
  await page.goto(path + '?example=normal&action=run');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('응답');
  await expect(stamp(page)).toHaveCount(0);
  await expect(page.getByText('지금 확인할 정리 항목이 없어요')).toHaveCount(0);
  api.control.body = undefined;
  api.control.network = true;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('연결');
  expect(api.requests).toHaveLength(2);
});

test('empty library, no recommendations and snapshot Off differ; preferences cannot rewrite snapshot', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  const state = api.users.get(testUser.id)!;
  state.links = [];
  await run(page);
  await expect(page.getByText('아직 저장된 링크가 없어요')).toBeVisible();
  await expect(
    page.getByRole('link', { name: '링크 추가하기' }),
  ).toHaveAttribute('href', '/links/new');
  state.links = organizationState().links.filter((link) => link.isFavorite);
  state.cleanupThresholdDays = null;
  await run(page);
  await expect(page.getByText('지금 확인할 정리 항목이 없어요')).toBeVisible();
  state.links = organizationState().links;
  api.control.body = (report) => ({
    ...report,
    cleanupCandidates: {
      ...report.cleanupCandidates,
      thresholdDays: null,
      totalCount: 0,
      items: [],
      truncated: false,
    },
    summary: { ...report.summary, cleanupCandidateCount: 0 },
  });
  state.cleanupThresholdDays = 7;
  await run(page);
  await expect(
    page.getByRole('region', { name: '오래 사용하지 않은 링크' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: '카테고리가 없는 링크' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: '정보 수집에 실패한 링크' }),
  ).toBeVisible();
  await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toBeVisible();
});

test('total 15 / API 10 / UI 3 are distinct; no invented pagination or domain writes', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context),
    state = api.users.get(testUser.id)!;
  state.links = Array.from({ length: 15 }, (_, index) => ({
    ...state.links[2]!,
    id: fixtureId(`uncat-${index}`),
    categoryId: null,
  }));
  await run(page);
  const region = page.getByRole('region', { name: '카테고리가 없는 링크' });
  await region.getByRole('button').click();
  await expect(region.getByText('전체 15개 중 3개 표시')).toBeVisible();
  await expect(region.getByText(/보고서에 포함된 10개/)).toBeVisible();
  await expect(region.getByRole('link')).toHaveCount(3);
  expect(api.requests).toHaveLength(1);
  expect(
    api.productRequests.filter((request) => request.method() !== 'GET'),
  ).toHaveLength(0);
});

test('link detail does not Open; explicit category edit marks snapshot stale until manual analysis', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  await run(page);
  const original = await stamp(page).getAttribute('datetime');
  const region = page.getByRole('region', { name: '카테고리가 없는 링크' });
  await region.getByRole('button').click();
  await region.getByRole('link').first().click();
  await expect(page).toHaveURL(`/links/${fixtureId('react')}`);
  expect(
    api.productRequests.filter((request) => request.method() !== 'GET'),
  ).toHaveLength(0);
  await editLinkInfo(page);
  await page
    .getByLabel('카테고리', { exact: true })
    .selectOption(fixtureId('design'));
  await page.getByRole('button', { name: '변경 저장' }).click();
  await expect
    .poll(
      () =>
        api.users
          .get(testUser.id)
          ?.links.find((link) => link.id === fixtureId('react'))?.categoryId,
    )
    .toBe(fixtureId('design'));
  await requestLinkDeletion(page);
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.goBack();
  await expect(stamp(page)).toHaveAttribute('datetime', original!);
  await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toBeVisible();
  await expect(
    page.getByRole('region', { name: '카테고리가 없는 링크' }),
  ).toBeVisible();
  expect(api.requests).toHaveLength(1);
  await page.getByRole('button', { name: '다시 분석', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '카테고리가 없는 링크' }),
  ).toHaveCount(0);
  await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toHaveCount(0);
  expect(
    api.productRequests.filter(
      (request) =>
        request.method() === 'DELETE' || request.url().endsWith('/open'),
    ),
  ).toHaveLength(0);
});

test('category creation/order edits and Cleanup setting changes mark stale without POST', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  await run(page);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '카테고리', exact: true })
    .click();
  await page
    .getByRole('button', { name: '카테고리 추가', exact: true })
    .click();
  await page.getByLabel('카테고리 이름', { exact: true }).fill('보고서 테스트');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByText('보고서 테스트', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toBeVisible();
  expect(api.requests).toHaveLength(1);
  await page.getByRole('button', { name: '다시 분석', exact: true }).click();
  await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toHaveCount(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '설정', exact: true })
    .click();
  await page.getByLabel('미사용 링크 추천 기간').selectOption('off');
  await expect(
    page.getByRole('status').filter({ hasText: '저장했어요.' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toBeVisible();
  await expect(
    page.getByRole('region', { name: '오래 사용하지 않은 링크' }),
  ).toBeVisible();
  expect(api.requests).toHaveLength(2);
  await page.getByRole('button', { name: '다시 분석', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '오래 사용하지 않은 링크' }),
  ).toHaveCount(0);
});

test('timezone is canonical and per-zone cache switches without an automatic report', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', {
    timezoneId: 'America/Los_Angeles',
  });
  await run(page);
  expect(api.requests[0]!.postDataJSON()).toEqual({
    timeZone: 'America/Los_Angeles',
  });
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Seoul' });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('원할 때 추천을 확인하세요')).toBeVisible();
  expect(api.requests).toHaveLength(1);
  await page.getByRole('button', { name: '추천 확인하기' }).click();
  await expect(stamp(page)).toBeVisible();
  expect(api.requests[1]!.postDataJSON()).toEqual({ timeZone: 'Asia/Seoul' });
  for (const zone of ['+09:00', 'GMT+9', 'bad', null])
    expect(normalizeOrganizationTimeZone(zone)).toBeNull();
  expect(normalizeOrganizationTimeZone('UTC')).toBe('UTC');
});

test('A in-flight report is aborted on B switch; A IDs and titles never install in B cache', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  await run(page);
  let release = () => {};
  api.control.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.getByRole('button', { name: '다시 분석', exact: true }).click();
  await expect.poll(() => api.requests.length).toBe(2);
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('원할 때 추천을 확인하세요')).toBeVisible();
  release();
  api.control.gate = undefined;
  await expect(stamp(page)).toHaveCount(0);
  await page.getByRole('button', { name: '추천 확인하기' }).click();
  await expect(stamp(page)).toBeVisible();
  const region = page.getByRole('region', { name: '카테고리가 없는 링크' });
  await region.getByRole('button').click();
  await expect(region.getByRole('link')).toContainText('B 전용');
  await expect(
    page.locator(`a[href="/links/${fixtureId('react')}"]`),
  ).toHaveCount(0);
});

test('protected path supports Google and email safe return', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  expect(safeNext(path + '?action=run')).toBe(path + '?action=run');
  expect(safeNext('//evil.test')).toBe('/');
  await context.clearCookies();
  await page.goto(path + '?action=run');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Google로 계속하기' }).click();
  await expect(stamp(page)).toBeVisible();
  expect(api.requests).toHaveLength(1);
  await context.clearCookies();
  await page.goto(path);
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({ json: testSession(false, 'email') }),
  );
  await page
    .getByRole('button', { name: '이메일로 로그인', exact: true })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '이메일',
  );
  await page.getByLabel('이메일', { exact: true }).fill(testUser.email);
  await page
    .getByLabel('비밀번호', { exact: true })
    .fill('isolated-fixture-password');
  await page
    .getByRole('button', { name: '이메일로 로그인', exact: true })
    .click();
  await expect(page.getByText('원할 때 추천을 확인하세요')).toBeVisible();
  expect(api.requests).toHaveLength(1);
});

for (const action of [
  'favorite',
  'open',
  'delete',
  'create',
  'category-order',
  'category-delete',
] as const)
  test(`${action} mutation marks the cached report stale without analysis`, async ({
    page,
    context,
  }) => {
    const api = await installOrganizationApi(context);
    await run(page);
    const original = await stamp(page).getAttribute('datetime');
    if (action.startsWith('category-')) {
      await page
        .getByRole('navigation')
        .getByRole('link', { name: '카테고리', exact: true })
        .click();
      if (action === 'category-order') {
        await page
          .getByRole('button', { name: '순서 변경', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'AI 아래로 이동', exact: true })
          .click();
        await page.getByRole('button', { name: '완료', exact: true }).click();
        await expect
          .poll(
            () =>
              api.users
                .get(testUser.id)
                ?.categories.find((category) => category.name === 'AI')
                ?.sortOrder,
          )
          .toBe(1);
      } else {
        await categoryMenu(page, 'AI', '삭제');
        await page
          .getByRole('button', { name: '카테고리 삭제', exact: true })
          .click();
        await expect(
          page.getByRole('button', { name: 'AI 관리', exact: true }),
        ).toHaveCount(0);
      }
    } else if (action === 'create') {
      await page
        .getByRole('navigation')
        .getByRole('link', { name: '내 링크', exact: true })
        .click();
      await registerLink(page);
      await page.locator('#link-url').fill('https://example.test/report-new');
      await page
        .getByRole('button', { name: '링크 등록', exact: true })
        .click();
      await expect(page).toHaveURL(/\/links\/[a-f0-9-]+$/);
    } else {
      const region = page.getByRole('region', { name: '카테고리가 없는 링크' });
      await region.getByRole('button').click();
      await region.getByRole('link').first().click();
      if (action === 'favorite') {
        await page
          .getByRole('navigation')
          .getByRole('link', { name: '내 링크', exact: true })
          .click();
        await page.getByRole('button', { name: /^React.* 즐겨찾기$/ }).click();
        await expect(
          page.getByRole('button', { name: /^React.* 즐겨찾기$/ }),
        ).toHaveAttribute('aria-pressed', 'true');
      } else if (action === 'open') {
        const popup = page.waitForEvent('popup');
        await page
          .getByRole('link', { name: '새 탭에서 열기', exact: true })
          .click();
        const opened = await popup;
        await expect
          .poll(
            () =>
              api.users
                .get(testUser.id)
                ?.links.find((link) => link.id === fixtureId('react'))
                ?.lastOpenedAt,
          )
          .not.toBeNull();
        await opened.close();
      } else {
        await requestLinkDeletion(page);
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: '링크 삭제', exact: true })
          .click();
        await expect(page).toHaveURL('/links');
      }
    }
    for (
      let index = 0;
      index < 3 && new URL(page.url()).pathname !== path;
      index++
    )
      await page.goBack();
    await expect(stamp(page)).toHaveAttribute('datetime', original!);
    await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toBeVisible();
    expect(api.requests).toHaveLength(1);
  });

test('domain write during an in-flight report keeps the arriving snapshot stale', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  await run(page);
  let release = () => {};
  api.control.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.getByRole('button', { name: '다시 분석', exact: true }).click();
  await expect.poll(() => api.requests.length).toBe(2);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  await page.getByRole('button', { name: /^React.* 즐겨찾기$/ }).click();
  await expect(
    page.getByRole('button', { name: /^React.* 즐겨찾기$/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  release();
  api.control.gate = undefined;
  await expect(
    page.getByRole('button', { name: '다시 분석', exact: true }),
  ).toBeEnabled();
  await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toBeVisible();
  await page.getByRole('button', { name: '다시 분석', exact: true }).click();
  await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toHaveCount(0);
});

test('logout clears A and B starts without A snapshot', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  await run(page);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '설정', exact: true })
    .click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await authenticate(context, false, 'alternate');
  await page.goto(path);
  await expect(page.getByText('원할 때 추천을 확인하세요')).toBeVisible();
  await expect(stamp(page)).toHaveCount(0);
  await page.getByRole('button', { name: '추천 확인하기' }).click();
  await expect(stamp(page)).toBeVisible();
  const region = page.getByRole('region', { name: '카테고리가 없는 링크' });
  await region.getByRole('button').click();
  await expect(region.getByRole('link')).toContainText('B 전용');
  expect(api.requests).toHaveLength(2);
});

test('failed browser timezone lookup falls back to Asia/Seoul', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  await page.addInitScript(() => {
    const Original = Intl.DateTimeFormat;
    Object.defineProperty(Intl, 'DateTimeFormat', {
      configurable: true,
      value: function (
        ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
      ) {
        if (args.length === 0) throw new Error('isolated timezone failure');
        return new Original(...args);
      },
    });
  });
  await run(page);
  expect(api.requests[0]!.postDataJSON()).toEqual({ timeZone: 'Asia/Seoul' });
});

for (const width of [320, 390, 512, 1440])
  test(`real client report and long text fit ${width}px`, async ({
    page,
    context,
  }) => {
    const api = await installOrganizationApi(context);
    const state = api.users.get(testUser.id)!;
    state.links[2]!.title = '긴 링크 제목 표시 확인 '.repeat(15);
    state.links[2]!.domain = 'long-domain'.repeat(20) + '.example.test';
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(
      page.getByRole('region', { name: '카테고리', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/rag-wo-05-4-b/${width}-home.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await run(page);
    await page.screenshot({
      path: `artifacts/rag-wo-05-4-b/${width}-report.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page
      .getByRole('region', { name: '카테고리가 없는 링크' })
      .getByRole('button')
      .click();
    await page.screenshot({
      path: `artifacts/rag-wo-05-4-b/${width}-detail.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expectLayoutWidth(page);
  });
