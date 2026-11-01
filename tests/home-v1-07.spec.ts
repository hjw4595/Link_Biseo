import { selectLinkFilter } from './link-filter-helper';
import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, testUser, authenticate } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import { expectLayoutWidth } from './layout-assertions';

const root = 'artifacts/wo-v1-07';
for (const [favoriteCount, categoryCount] of [
  [0, 0],
  [3, 1],
  [3, 3],
  [6, 5],
]) {
  test(`mobile compact data favorites ${favoriteCount} categories ${categoryCount}`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const data = initialProduct();
    data.links.forEach((link, i) => {
      link.isFavorite = i < favoriteCount!;
    });
    data.categories = data.categories.slice(0, categoryCount);
    api.users.set(testUser.id, data);
    const presets = await presetApi(page, 50);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('link-item')).toHaveCount(favoriteCount!);
    if (favoriteCount === 0)
      await expect(
        page.getByText('즐겨찾기한 링크가 없어요.', { exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole('region', { name: '카테고리', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: '빠른 실행', exact: true }),
    ).toHaveCount(0);
    expect(presets.requests).toHaveLength(0);
    await expectLayoutWidth(page);
    await mkdir(`${root}/screenshots`, { recursive: true });
    await page.screenshot({
      path: `${root}/screenshots/mobile-${favoriteCount}-favorites-${categoryCount}-categories.png`,
      fullPage: true,
    });
  });
}
async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const e = document.querySelector(selector);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: r.top + scrollY, height: r.height, width: r.width };
    };
    return {
      height: document.documentElement.scrollHeight,
      viewport: innerWidth,
      favorites: box('[aria-labelledby="favorites-heading"]'),
      categories: box('[aria-labelledby="home-heading"]'),
      card: box('[aria-label="빠른 실행 목록"] > li'),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}
for (const width of [
  320, 375, 390, 430, 512, 768, 1023, 1024, 1280, 1440, 1920,
]) {
  test(`approved home boundary and no mobile preset reads ${width}`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const data = initialProduct();
    data.links.forEach((l) => {
      l.isFavorite = true;
    });
    data.links[0]!.title = '긴 제목 한글 English 日本語 '.repeat(10);
    data.categories[0]!.name = '매우 긴 카테고리 이름 '.repeat(6);
    api.users.set(testUser.id, data);
    const presets = await presetApi(page, 50);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('link-item')).toHaveCount(6);
    await expect(
      page.getByRole('region', { name: '카테고리', exact: true }),
    ).toHaveCount(0);
    await expectLayoutWidth(page);
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: '전체 링크 검색' }),
    ).toHaveCount(0);
    if (width < 1024) {
      await expect(
        page.getByRole('region', { name: '빠른 실행', exact: true }),
      ).toHaveCount(0);
      expect(presets.requests).toHaveLength(0);
      await expect(
        page.getByRole('button', { name: '빠른 실행 추가' }),
      ).toHaveCount(0);
    } else {
      await expect(
        page
          .getByRole('list', { name: '빠른 실행 목록' })
          .locator(':scope > li'),
      ).toHaveCount(6);
      await expect(
        page.getByRole('button', { name: '나머지 44개 보기' }),
      ).toBeVisible();
      await expect.poll(() => presets.requests.length).toBe(7);
    }
    await expect(page.locator('[aria-labelledby="home-heading"]')).toHaveCount(
      0,
    );
    const metrics = await measure(page);
    expect(metrics.overflow).toBe(false);
    expect(errors).toEqual([]);
    await mkdir(`${root}/screenshots`, { recursive: true });
    await page.screenshot({
      path: `${root}/screenshots/home-${width}.png`,
      fullPage: true,
    });
    await writeFile(
      `${root}/home-${width}.json`,
      JSON.stringify(
        {
          kind: 'Actual React UI / Mock API',
          metrics,
          requests: presets.requests,
        },
        null,
        2,
      ),
    );
  });
}

for (const count of [0, 1, 2, 6, 8, 30, 50]) {
  test(`preset preview, expanded list and measurements ${count}`, async ({
    page,
  }) => {
    const api = await presetApi(page, count);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const cards = page
      .getByRole('list', { name: '빠른 실행 목록' })
      .locator(':scope > li');
    await expect(cards).toHaveCount(Math.min(6, count));
    await expect(
      page.getByRole('button', { name: '편집', exact: true }),
    ).toHaveCount(0);
    const before = await measure(page);
    await expect
      .poll(
        () =>
          api.requests.filter((r) => r.path !== '/quick-launch-presets').length,
      )
      .toBe(Math.min(6, count));
    await mkdir(`${root}/screenshots`, { recursive: true });
    await page.screenshot({
      path: `${root}/screenshots/presets-${count}-preview.png`,
      fullPage: true,
    });
    if (count > 6) {
      await page
        .getByRole('button', { name: `나머지 ${count - 6}개 보기` })
        .click();
      await expect(cards).toHaveCount(count);
      expect(
        api.requests.filter((r) => r.path === '/quick-launch-presets'),
      ).toHaveLength(1);
      const visibleCount = await cards.evaluateAll(
        (nodes) =>
          nodes.filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < innerHeight;
          }).length,
      );
      // Expanding moves the focused "show all" button; scroll anchoring may
      // expose the last rows. Only initial six + cards actually in view load.
      expect(
        api.requests.filter((r) => r.path !== '/quick-launch-presets').length,
      ).toBeLessThanOrEqual(Math.min(count, 6 + visibleCount));
    }
    const all = await measure(page);
    await page.screenshot({
      path: `${root}/screenshots/presets-${count}-all.png`,
      fullPage: true,
    });
    if (count) {
      await page
        .getByRole('button', { name: '업무 1 펼치기', exact: true })
        .click();
      await expect(
        page.getByRole('list', { name: '업무 1 포함 링크' }),
      ).toBeVisible();
    }
    const expanded = await measure(page);
    if (count > 6) {
      await page
        .getByRole('button', { name: '목록 접기', exact: true })
        .click();
      await expect(cards).toHaveCount(6);
      await expect(
        page.getByRole('button', { name: `나머지 ${count - 6}개 보기` }),
      ).toBeFocused();
    }
    await writeFile(
      `${root}/presets-${count}.json`,
      JSON.stringify(
        {
          kind: 'Actual React UI / Mock API',
          before,
          all,
          expanded,
          requests: api.requests,
        },
        null,
        2,
      ),
    );
  });
}

test('accordion selected detail only, fresh editor cache, full reorder crossing preview and reset', async ({
  page,
  context,
}) => {
  const api = await presetApi(page, 8);
  await page.goto('/');
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  await expect(
    page.getByRole('list', { name: '업무 1 포함 링크' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '편집', exact: true }).click();
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue('업무 1');
  await page.getByRole('button', { name: '취소', exact: true }).click();
  expect(
    api.requests.filter((r) => r.path.endsWith(api.items[0]!.id)),
  ).toHaveLength(1);
  await page
    .getByRole('button', { name: '업무 6 펼치기', exact: true })
    .click();
  await expect(
    page.getByRole('list', { name: '업무 1 포함 링크' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: '업무 6 아래로 이동', exact: true })
    .click();
  expect(api.requests.some((r) => r.path.endsWith('/reorder'))).toBe(false);
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '빠른 실행 목록' }).locator(':scope > li'),
  ).toHaveCount(6);
  const order = api.requests.find((r) => r.path.endsWith('/reorder'));
  expect(order?.body).toEqual({
    presetIds: api.items
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => p.id),
  });
  await page.getByRole('button', { name: '나머지 2개 보기' }).click();
  await page.getByRole('button', { name: '목록 접기' }).click();
  await expect(page.getByRole('button', { expanded: true })).toHaveCount(0);
  await page.getByRole('button', { name: '나머지 2개 보기' }).click();
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByRole('button', { name: '나머지 2개 보기' }),
  ).toBeVisible();
});

for (const status of [403, 404, 500])
  test(`detail failure ${status} local retry does not open links`, async ({
    page,
    context,
  }) => {
    const product = await installProductApi(context);
    const api = await presetApi(page, 2);
    api.detailFailure = status;
    await page.goto('/');
    await page
      .getByRole('button', { name: '업무 1 펼치기', exact: true })
      .click();
    const card = page.getByRole('listitem', {
      name: '빠른 실행 업무 1',
      exact: true,
    });
    await expect(card.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('region', { name: '즐겨찾기', exact: true }),
    ).toBeVisible();
    api.detailFailure = 0;
    await card
      .getByRole('button', { name: '다시 불러오기', exact: true })
      .click();
    await expect(card.getByRole('list')).toBeVisible();
    expect(
      product.requests.filter((r) => r.url().endsWith('/open')),
    ).toHaveLength(0);
  });

for (const members of [0, 1, 20])
  test(`member list ${members} bounds, keyboard and no implicit execution`, async ({
    page,
    context,
  }) => {
    const product = await installProductApi(context);
    const api = await presetApi(page, 2, 0);
    const seed = initialProduct().links[0]!;
    api.items[0]!.links = Array.from({ length: members }, (_, i) => ({
      sortOrder: i,
      link: {
        ...seed,
        id: fixtureId(`member-${i}`),
        title: `포함 링크 ${i + 1}`,
      },
    }));
    api.items[0]!.linkCount = members;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page
      .getByRole('button', { name: '업무 1 펼치기', exact: true })
      .click();
    if (members) {
      const list = page.getByRole('list', { name: '업무 1 포함 링크' });
      await expect(list.locator('li')).toHaveCount(members);
      expect((await list.boundingBox())?.height).toBeLessThanOrEqual(280);
      await list.getByRole('link').last().focus();
      await expect(list.getByRole('link').last()).toBeFocused();
      expect(
        await list
          .getByRole('link')
          .last()
          .evaluate((e) => {
            const r = e.getBoundingClientRect();
            const p = e.closest('ul')!.getBoundingClientRect();
            return r.top >= p.top && r.bottom <= p.bottom;
          }),
      ).toBe(true);
      await page.getByRole('button', { name: '편집', exact: true }).focus();
      await expect(
        page.getByRole('button', { name: '편집', exact: true }),
      ).toBeFocused();
      await page.setViewportSize({ width: 1440, height: 500 });
      expect((await list.boundingBox())?.height).toBeLessThanOrEqual(200);
      await page.setViewportSize({ width: 1440, height: 900 });
    } else
      await expect(
        page
          .getByRole('listitem', { name: '빠른 실행 업무 1', exact: true })
          .getByText('포함된 링크가 없어요. 편집에서 링크를 추가해 주세요.'),
      ).toBeVisible();
    expect(
      product.requests.filter((r) => r.url().endsWith('/open')),
    ).toHaveLength(0);
    await page.screenshot({
      path: `${root}/screenshots/members-${members}.png`,
      fullPage: true,
    });
  });

for (const width of [390, 1440])
  test(`My Links search, URL restoration, empty states, management and headings ${width}`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    await page.setViewportSize({ width, height: 900 });
    const reportRequests = () =>
      api.requests.filter(
        (request) =>
          request.method() === 'POST' &&
          request.url().includes('/organization-reports'),
      );
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: '비서의 추천', exact: true }),
    ).toBeVisible();
    expect(reportRequests()).toHaveLength(1);
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '내 링크', exact: true })
      .click();
    const search = page.getByRole('searchbox', { name: '저장한 링크 검색' });
    await expect(search).not.toBeFocused();
    await search.fill('nothing-v107');
    await expect(
      page.getByText('검색 결과가 없어요.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '검색어 지우기' }).click();
    await expect(search).toHaveValue('');
    await search.fill('ChatGPT');
    await expect(page.getByTestId('link-item')).toHaveCount(1);
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '홈', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: '비서의 추천', exact: true }),
    ).toBeVisible();
    expect(reportRequests()).toHaveLength(1);
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '내 링크', exact: true })
      .click();
    await expect(search).not.toBeFocused();
    await page.goto('/links?q=ChatGPT');
    await expect(search).toHaveValue('ChatGPT');
    await page.reload();
    await expect(search).toHaveValue('ChatGPT');
    await expect(search).not.toBeFocused();
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '홈', exact: true })
      .click();
    // Browser reloads above create a new QueryClient; this Home needs one new report.
    await expect(
      page.getByRole('button', { name: '비서의 추천', exact: true }),
    ).toBeVisible();
    expect(reportRequests()).toHaveLength(2);
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '내 링크', exact: true })
      .click();
    await expect(search).not.toBeFocused();
    await expect(
      page.getByRole('region', { name: '링크 관리 도구' }),
    ).toHaveCount(0);
    await expect(
      page.getByText('링크별 사용 지표', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: '카테고리 관리', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '관리 도구', exact: true }),
    ).toHaveCount(0);
    expect(reportRequests()).toHaveLength(2);
    await page.goto('/settings');
    await expect(page.locator('h1')).toHaveText('설정');
    await expect(page.locator('h2')).toHaveText([
      '계정',
      '사용 통계',
      '카테고리별 링크 분포',
      '링크 관리 설정',
    ]);
    await expect(page.getByText(/비서의 추천에서 정리 후보/)).toBeVisible();
    expect(
      await page.locator('meta[name="description"]').getAttribute('content'),
    ).not.toContain('UI 데모');
  });

test('category error is local and recoverable; filter empty is not empty library', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  let fail = true;
  await page.route('**/categories', (route) =>
    fail
      ? route.fulfill({
          status: 500,
          headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
          json: {},
        })
      : route.fallback(),
  );
  await page.goto('/links');
  await expect(
    page.getByText('카테고리 조회 실패', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('카테고리 확인 중', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByTestId('link-item')).toHaveCount(8);
  const reads = api.requests.filter(
    (r) => new URL(r.url()).pathname === '/links',
  ).length;
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(
    page.getByText('카테고리 조회 실패', { exact: true }),
  ).toHaveCount(0);
  expect(
    api.requests.filter((r) => new URL(r.url()).pathname === '/links'),
  ).toHaveLength(reads);
  await selectLinkFilter(page, 'uncategorized');
  await expect(
    page.getByText('조건에 맞는 링크가 없어요.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(8);
});
