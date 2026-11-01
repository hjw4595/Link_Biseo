import { selectLinkFilter } from './link-filter-helper';
import { mkdir } from 'node:fs/promises';
import { test, expect, testUser, authenticate } from './auth-fixture';
import { initialProduct, installProductApi } from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import { expectLayoutWidth } from './layout-assertions';

const favorites = { name: '즐겨찾기', exact: true };
for (const width of [320, 375, 390, 430, 512, 768, 1024, 1280, 1440])
  test(`home order, bounded queries and grids at ${width}px`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const state = initialProduct();
    state.links.forEach((link, i) => {
      link.isFavorite = i !== 0;
    });
    const long = state.links[1]!;
    long.title = '한글 English 日本語 '.repeat(20);
    long.domain = 'very-long-domain'.repeat(20) + '.example.com';
    api.users.set(testUser.id, state);
    const presets = await presetApi(page, 3);
    presets.items[0]!.name = '긴 묶음 이름 日本語 English '.repeat(4);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(
      page.getByRole('region', favorites).getByTestId('link-item'),
    ).toHaveCount(6);
    if (width >= 1024)
      await expect(
        page
          .getByRole('list', { name: '빠른 실행 목록' })
          .locator(':scope > li'),
      ).toHaveCount(3);
    else
      await expect(
        page.getByRole('region', { name: '빠른 실행', exact: true }),
      ).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: '카테고리', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '비서의 추천', exact: true }),
    ).toBeVisible();
    expect(
      await page
        .locator('.screen-content > section')
        .evaluateAll((nodes) =>
          nodes.map(
            (n) =>
              n.querySelector('h2 button')?.getAttribute('aria-label') ??
              n.querySelector('h2')?.textContent?.trim(),
          ),
        ),
    ).toEqual(
      width >= 1024
        ? ['빠른 실행', '즐겨찾기', '비서의 추천']
        : ['즐겨찾기', '비서의 추천'],
    );
    await expect(
      page.getByRole('link', { name: '전체 링크 검색' }),
    ).toHaveCount(0);
    await expect(page.getByRole('search')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /비서의 추천/ })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('region', { name: '저장한 링크', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'ChatGPT 열기', exact: true }),
    ).toHaveCount(0);
    const reads = api.requests.filter(
      (r) => r.method() === 'GET' && new URL(r.url()).pathname === '/links',
    );
    expect(reads).toHaveLength(1);
    const query = new URL(reads[0]!.url()).searchParams;
    expect(query.get('favorite')).toBe('true');
    expect(query.get('limit')).toBe('6');
    expect(query.has('cursor')).toBe(false);
    if (width >= 1024) {
      await expect.poll(() => presets.requests.length).toBe(4);
      expect(presets.requests.map((r) => r.path).sort()).toEqual(
        [
          '/quick-launch-presets',
          ...presets.items.map((p) => `/quick-launch-presets/${p.id}`),
        ].sort(),
      );
    } else expect(presets.requests).toEqual([]);
    const grids = [
      [
        page.getByRole('list', { name: '빠른 실행 목록' }),
        width >= 1024 ? 2 : 0,
      ],
      [
        page
          .getByRole('region', favorites)
          .getByRole('list', { name: '링크 목록' }),
        width >= 1024 ? 2 : 1,
      ],
      [page.getByRole('list', { name: '내 카테고리' }), 0],
    ] as const;
    for (const [grid, columns] of grids) {
      if (!columns) {
        await expect(grid).toHaveCount(0);
        continue;
      }
      expect(
        await grid.evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
        ),
      ).toBe(columns);
      expect(
        await grid.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
    await expectLayoutWidth(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await mkdir('artifacts/wo-v1-04/screenshots', { recursive: true });
    await page.screenshot({
      path: `artifacts/wo-v1-04/screenshots/home-${width}.png`,
      fullPage: true,
    });
  });

test('favorites view-all keeps URL filter after reload and composes with server search', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.goto('/');
  await page
    .getByRole('region', favorites)
    .getByRole('link', { name: '전체보기', exact: true })
    .click();
  await expect(page).toHaveURL('/links?favorite=true');
  await expect(page.getByRole('button', favorites)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.getByRole('button', favorites)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page
    .getByRole('searchbox', { name: '저장한 링크 검색' })
    .fill('ChatGPT');
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  expect(
    api.requests.some((r) => {
      const q = new URL(r.url()).searchParams;
      return q.get('favorite') === 'true' && q.get('q') === 'ChatGPT';
    }),
  ).toBe(true);
  await selectLinkFilter(page, 'all');
  await expect(page.getByRole('button', favorites)).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('unfavorite refreshes home without opening link; all-link navigation remains available', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.goto('/');
  await page
    .getByRole('button', { name: 'ChatGPT 즐겨찾기', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'ChatGPT 열기', exact: true }),
  ).toHaveCount(0);
  expect(
    api.requests.filter((r) => new URL(r.url()).pathname.endsWith('/open')),
  ).toHaveLength(0);
  expect(
    api.users.get(testUser.id)?.links.find((l) => l.title === 'ChatGPT')
      ?.isFavorite,
  ).toBe(false);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'ChatGPT 열기', exact: true }),
  ).toBeVisible();
});

for (const width of [390, 1440])
  test(`empty favorites do not imply empty library at ${width}px`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const state = initialProduct();
    state.links.forEach((l) => {
      l.isFavorite = false;
    });
    api.users.set(testUser.id, state);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(
      page.getByText('즐겨찾기한 링크가 없어요.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('아직 링크가 없어요', { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/wo-v1-04/screenshots/empty-favorites-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('link', { name: '전체 링크 보기', exact: true })
      .click();
    await expect(page.getByTestId('link-item')).toHaveCount(8);
  });

for (const resource of ['links', 'categories', 'quick-launch-presets'])
  test(`home ${resource} error stays separate from empty and other sections`, async ({
    page,
  }) => {
    await page.route(`http://127.0.0.1:54329/${resource}**`, (route) =>
      route.fulfill({
        status: 500,
        headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
        json: {},
      }),
    );
    await page.goto('/');
    if (resource === 'categories') {
      await expect(
        page.getByText('카테고리 조회 실패', { exact: true }),
      ).toHaveCount(0);
      await expect(page.getByTestId('link-item')).toHaveCount(3);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(
        page.getByRole('region', { name: '카테고리', exact: true }),
      ).toHaveCount(0);
      return;
    }
    const section = resource === 'links' ? '즐겨찾기' : '빠른 실행';
    await expect(
      page
        .getByRole('region', { name: section, exact: true })
        .getByRole('alert'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '전체 링크 검색' }),
    ).toHaveCount(0);
    if (resource !== 'links')
      await expect(
        page.getByRole('region', favorites).getByTestId('link-item'),
      ).toHaveCount(3);
    else
      await expect(
        page.getByRole('region', { name: '카테고리', exact: true }),
      ).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

test('blank and whitespace My Links search use normal server list; Enter encodes special input', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  for (const q of ['', '   ', '한글&日本語?#']) {
    await page.goto('/');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '내 링크', exact: true })
      .click();
    const input = page.getByRole('searchbox', { name: '저장한 링크 검색' });
    await input.fill(q);
    await input.press('Enter');
    await expect(
      page.getByRole('searchbox', { name: '저장한 링크 검색' }),
    ).toHaveValue(q);
    await expect
      .poll(() =>
        api.requests.some((r) => {
          const u = new URL(r.url());
          return (
            u.pathname === '/links' &&
            u.searchParams.get('limit') === '20' &&
            (u.searchParams.get('q') ?? '') === q.trim()
          );
        }),
      )
      .toBe(true);
  }
});

test('home favorites are account scoped after switching identity', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const a = initialProduct();
  a.links[0]!.title = 'A private favorite';
  api.users.set(testUser.id, a);
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'A private favorite 열기', exact: true }),
  ).toBeVisible();
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByRole('link', { name: 'ChatGPT 열기', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'A private favorite 열기', exact: true }),
  ).toHaveCount(0);
});

test('empty Home retains registration entry without category setup at mobile and desktop', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  state.links = [];
  state.categories = [];
  api.users.set(testUser.id, state);
  let reports = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/organization-reports'))
      reports++;
  });
  await mkdir('artifacts/wo-v1-04/screenshots', { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByText('즐겨찾기한 링크가 없어요.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: '카테고리', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: '링크 추가', exact: true }),
    ).toHaveAttribute('href', '/links/new');
    await page.screenshot({
      path: `artifacts/wo-v1-04/screenshots/empty-home-${width}.png`,
      fullPage: true,
    });
    await expect.poll(() => reports).toBe(width === 390 ? 1 : 2);
    await expect(
      page.getByRole('button', { name: '비서의 추천', exact: true }),
    ).toHaveCount(0);
    await page.goto('/settings');
    await expect(page.getByRole('link', { name: /비서의 추천/ })).toHaveCount(
      0,
    );
    await page.goto('/links');
    await expect(page.getByRole('link', { name: /비서의 추천/ })).toHaveCount(
      0,
    );
    await page.goto('/assistant/organization');
    await expect(page).toHaveURL('/assistant/organization');
    await expect(
      page
        .getByRole('navigation')
        .getByRole('link', { name: '내 링크', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByText('원할 때 추천을 확인하세요', { exact: true }),
    ).toBeVisible();
    expect(reports).toBe(width === 390 ? 1 : 2);
  }
});

test('invalid 101-character My Links search retains input and existing server error UI', async ({
  page,
}) => {
  let sent = '';
  await page.route('http://127.0.0.1:54329/links?**', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (!q) return route.fallback();
    sent = q;
    await route.fulfill({
      status: 400,
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: {},
    });
  });
  await page.goto('/');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  await page
    .getByRole('searchbox', { name: '저장한 링크 검색' })
    .fill('x'.repeat(101));
  await expect(
    page.getByRole('alert').filter({
      hasText: '입력값이나 목록 조건을 확인해 주세요.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('searchbox', { name: '저장한 링크 검색' }),
  ).toHaveValue('x'.repeat(101));
  expect(sent).toHaveLength(101);
  await expect(
    page.getByText('아직 링크가 없어요', { exact: true }),
  ).toHaveCount(0);
});
