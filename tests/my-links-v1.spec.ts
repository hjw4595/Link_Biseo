import { mkdir } from 'node:fs/promises';
import { test, expect, testUser } from './auth-fixture';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import { expectLayoutWidth } from './layout-assertions';
import { bookmarkHtml } from './bookmark-browser-helper';

for (const width of [320, 375, 390, 430, 512, 640, 768, 1024, 1280, 1440])
  test(`my links management and navigation at ${width}px`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const state = initialProduct();
    state.links[0]!.title = '한글 日本語 Long title '.repeat(15);
    state.links[0]!.domain = 'long-domain'.repeat(30) + '.test';
    api.users.set(testUser.id, state);
    let reports = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().includes('/organization-reports')
      )
        reports++;
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/links');
    await expect(page.getByTestId('link-item')).toHaveCount(8);
    const nav = page.getByRole('navigation', { name: '주요 메뉴' });
    await expect(nav.getByRole('link')).toHaveText([
      ...(width >= 1024 ? ['LINK BISEO'] : []),
      '홈',
      '카테고리',
      '내 링크',
      '설정',
    ]);
    await expect(page).toHaveURL('/links');
    await page.keyboard.press('Escape');
    await expect(nav.locator('[aria-current=page]')).toHaveText('내 링크');
    await expectLayoutWidth(page);
    const filters = (await page
      .getByRole('group', { name: '링크 필터' })
      .boundingBox())!;
    const sort = (await page
      .getByLabel('정렬', { exact: true })
      .boundingBox())!;
    expect(sort.x).toBeGreaterThanOrEqual(filters.x);
    expect(sort.x + sort.width).toBeLessThanOrEqual(
      filters.x + filters.width + 1,
    );
    expect(sort.y).toBeGreaterThanOrEqual(filters.y);
    const rows = await page.getByTestId('link-item').all();
    for (const row of rows) {
      const detail = row.getByRole('button', { name: /상세 보기/ });
      await expect(detail).toBeVisible();
    }
    await expect(
      page.getByRole('list', { name: '링크 목록', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: '링크 관리 도구' }),
    ).toHaveCount(0);
    await expect(
      page.getByText('링크별 사용 지표', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: '카테고리 관리', exact: true }),
    ).toHaveCount(0);
    expect(
      api.requests.filter((r) =>
        /\/links\/[^/?]+(?:\/stats)?(?:\?|$)/.test(r.url()),
      ),
    ).toHaveLength(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await mkdir('artifacts/wo-v1-05/screenshots', { recursive: true });
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `artifacts/wo-v1-05/screenshots/links-${width}.png`,
        fullPage: true,
      });
    await rows[0]!.getByRole('button', { name: /상세 보기/ }).click();
    await expect(
      page.getByRole('heading', { name: '사용 빈도' }),
    ).toBeVisible();
    await expectLayoutWidth(page);
    await expect(page).toHaveURL('/links');
    await page.keyboard.press('Escape');
    await expect(nav.locator('[aria-current=page]')).toHaveText('내 링크');
    await expect
      .poll(
        () => api.requests.filter((r) => r.url().includes('/stats?')).length,
      )
      .toBe(1);
    const stats = api.requests.find((r) => r.url().includes('/stats?'))!;
    expect(new URL(stats.url()).searchParams.get('timeZone')).toBe(
      await page.evaluate(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    );
    for (const [path, active] of [
      ['/assistant/organization', '내 링크'],
      ['/links/import', '내 링크'],
      ['/settings', '설정'],
      ['/categories', '카테고리'],
    ] as const) {
      await page.goto(path);
      await expect(nav.locator('[aria-current=page]')).toHaveText(active);
      await expectLayoutWidth(page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (path === '/settings')
        await expect(
          page.getByRole('link', { name: /비서의 추천/ }),
        ).toHaveCount(0);
    }
    expect(reports).toBe(0);
  });

for (const width of [390, 1440])
  test(`empty management remains actionable at ${width}px`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const state = initialProduct();
    state.links = [];
    api.users.set(testUser.id, state);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/links');
    await expect(
      page.getByText('아직 링크가 없어요', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '링크 등록', exact: true }).last(),
    ).toHaveAttribute('href', '/links/new');
    await expect(page.getByRole('link', { name: /비서의 추천/ })).toHaveCount(
      0,
    );
    await mkdir('artifacts/wo-v1-05/screenshots', { recursive: true });
    await page.screenshot({
      path: `artifacts/wo-v1-05/screenshots/empty-${width}.png`,
      fullPage: true,
    });
  });

test('management toolbar preserves query, favorite, order and detail focus through resize', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.goto('/links?q=Figma&favorite=true');
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  const detail = page.getByRole('button', {
    name: 'Figma 상세 보기',
    exact: true,
  });
  await detail.focus();
  await expect(detail).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(detail).toBeFocused();
  await expect(detail).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole('searchbox')).toHaveValue('Figma');
  await expect(page.getByLabel('정렬', { exact: true })).toHaveValue(
    'frequent',
  );
  const last = api.requests
    .filter((r) => new URL(r.url()).pathname === '/links')
    .at(-1)!;
  expect(new URL(last.url()).searchParams.get('q')).toBe('Figma');
  expect(new URL(last.url()).searchParams.get('favorite')).toBe('true');
  expect(new URL(last.url()).searchParams.get('sort')).toBe('frequent');
});

test('import mapping layout preserves selection and no duplicate dispatch across resize', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  let calls = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('http://127.0.0.1:54329/links', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calls++;
    await gate;
    return route.fallback();
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/links/import');
  const file = page.getByLabel('HTML 파일 선택', { exact: true });
  await expect(file).toBeEnabled();
  await file.setInputFiles({
    name: 'resize.html',
    mimeType: 'text/html',
    buffer: Buffer.from(bookmarkHtml(3)),
  });
  const start = page.getByRole('button', {
    name: '선택한 링크 가져오기',
    exact: true,
  });
  await expect(start).toBeEnabled();
  await page.getByLabel('3번 북마크 선택', { exact: true }).uncheck();
  await page.getByLabel('분류 방식', { exact: true }).selectOption('single');
  await page
    .getByLabel('카테고리 선택', { exact: true })
    .selectOption(fixtureId('development'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByLabel('3번 북마크 선택', { exact: true }),
  ).not.toBeChecked();
  await expect(page.getByLabel('카테고리 선택', { exact: true })).toHaveValue(
    fixtureId('development'),
  );
  const preview = (await page
    .getByRole('region', { name: '북마크 미리보기' })
    .boundingBox())!;
  const mapping = (await page
    .getByRole('region', { name: '폴더별 카테고리 매핑' })
    .boundingBox())!;
  expect(mapping.x).toBeGreaterThan(preview.x + preview.width);
  await mkdir('artifacts/wo-v1-05/screenshots', { recursive: true });
  await page.screenshot({
    path: 'artifacts/wo-v1-05/screenshots/import-1440.png',
    fullPage: true,
  });
  await start.click();
  await expect.poll(() => calls).toBe(2);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(calls).toBe(2);
  release();
  await expect(
    page
      .getByRole('region', { name: '가져오기 실행 결과' })
      .locator('dl > div')
      .filter({ hasText: '등록 성공' }),
  ).toContainText('2개');
  expect(calls).toBe(2);
  expect(
    api.requests.filter(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/links',
    ),
  ).toHaveLength(2);
});

test('management keyboard order and 200 percent equivalent viewport reflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/links');
  await page.getByRole('searchbox').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('카테고리 필터')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('정렬', { exact: true })).toBeFocused();
  // Native browser zoom has a reduced CSS viewport; this is a reflow simulation.
  await page.setViewportSize({ width: 720, height: 450 });
  await expectLayoutWidth(page);
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(720);
});
