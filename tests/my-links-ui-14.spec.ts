import { test, expect, testUser } from './auth-fixture';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import {
  expectLayoutWidth,
  expectClearOfNavigation,
} from './layout-assertions';
import { mkdir, writeFile } from 'node:fs/promises';
const root = 'artifacts/wo-ui-14';
const ai = fixtureId('ai');
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
for (const width of [320, 390, 512, 768, 1024, 1440, 1920])
  test(`title list, actions, responsive filters and captures ${width}`, async ({
    page,
    context,
    browserName,
  }) => {
    const api = await installProductApi(context);
    const state = initialProduct();
    state.links[0]!.title = '긴 제목 English 日本語 '.repeat(15);
    state.categories[0]!.name = '아주 긴 카테고리 이름 '.repeat(10);
    api.users.set(testUser.id, state);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/links');
    await expect(
      page.getByText('전체 링크 8개', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('link-item')).toHaveCount(8);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByRole('searchbox')).toHaveAttribute(
      'placeholder',
      '제목 또는 주소 검색',
    );
    await expect(page.getByTestId('link-item').locator('img')).toHaveCount(0);
    for (const item of state.links)
      await expect(
        page.getByTestId('link-item').getByText(item.domain, { exact: true }),
      ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '관리 도구', exact: true }),
    ).toHaveCount(0);
    const longTitle = page
      .getByRole('link', { name: `${state.links[0]!.title} 열기`, exact: true })
      .locator('.truncate');
    await expect(longTitle).toHaveCSS('text-overflow', 'ellipsis');
    await expect(longTitle).toHaveCSS('white-space', 'nowrap');
    expect(
      await longTitle.evaluate((el) => el.scrollWidth > el.clientWidth),
    ).toBe(true);
    const first = page.getByTestId('link-item').first();
    const star = await first
      .getByRole('button', { name: /즐겨찾기$/ })
      .boundingBox();
    const detail = await first
      .getByRole('button', { name: /상세 보기$/ })
      .boundingBox();
    expect(star!.width).toBeGreaterThanOrEqual(44);
    expect(detail!.height).toBeGreaterThanOrEqual(44);
    const dir = `${root}/${browserName}/screenshots`;
    await mkdir(dir, { recursive: true });
    const shot = async (name: string) => {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `${dir}/${width}-${name}.png`,
        animations: 'disabled',
      });
    };
    await expectLayoutWidth(page);
    await shot('basic');
    if (width < 1024) {
      await page
        .getByRole('button', { name: '내 링크 더보기', exact: true })
        .click();
      await expect(
        page.getByRole('menuitem', { name: '북마크 가져오기', exact: true }),
      ).toBeInViewport();
      await shot('more');
      await page.keyboard.press('Escape');
    } else
      await expect(
        page
          .getByRole('group', { name: '링크 작업' })
          .getByRole('link', { name: '북마크 가져오기', exact: true }),
      ).toHaveAttribute('href', '/links/import');
    await page.getByLabel('카테고리 필터').selectOption('uncategorized');
    await expect(
      page.getByText('조건에 맞는 링크가 없어요.', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('카테고리 필터').selectOption(ai);
    await expect(page.getByTestId('link-item')).toHaveCount(4);
    await shot('category');
    await page.getByRole('button', { name: '즐겨찾기', exact: true }).click();
    await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
    await expect(page.getByTestId('link-item')).toHaveCount(2);
    await shot('filtered');
    await page.getByRole('searchbox').fill('no-ui14-result');
    await expect(
      page.getByText('검색 결과가 없어요.', { exact: true }),
    ).toBeVisible();
    await shot('no-results');
    await page
      .getByRole('button', { name: '필터 초기화', exact: true })
      .click();
    await expect(page.getByTestId('link-item')).toHaveCount(8);
    await expect(page).toHaveURL('/links');
    state.links = [];
    await page.reload();
    await expect(
      page.getByText('전체 링크 0개', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('아직 링크가 없어요', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '링크 등록', exact: true }).last(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '북마크 가져오기', exact: true }).last(),
    ).toBeVisible();
    if (width === 390) {
      await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
      await expect(
        page.getByText('아직 링크가 없어요', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: '북마크 가져오기', exact: true }).last(),
      ).toBeVisible();
      await page.getByRole('searchbox').fill('   ');
      await expect(
        page.getByText('아직 링크가 없어요', { exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: '초기화', exact: true }).click();
    }
    await shot('empty');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectClearOfNavigation(page, page.locator('.screen-content'));
    await writeFile(
      `${dir}/${width}-metrics.json`,
      JSON.stringify(
        { kind: 'Actual React UI / Mock HTTP API', width, star, detail },
        null,
        2,
      ),
    );
  });
test('rapid search preserves input identity, focus, URL and combined filters across reload/reset/back', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.goto('/links?keep=yes#anchor');
  const rscSearchRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.headers()['rsc'] === '1' &&
      url.pathname === '/links' &&
      url.searchParams.has('q')
    )
      rscSearchRequests.push(request.url());
  });
  const input = page.getByRole('searchbox');
  await input.focus();
  const identity = await input.elementHandle();
  await input.pressSequentially('ChatGPT', { delay: 20 });
  await expect(input).toHaveValue('ChatGPT');
  await expect(input).toBeFocused();
  expect(await identity?.evaluate((el) => el.isConnected)).toBe(true);
  await page.getByLabel('카테고리 필터').selectOption(ai);
  await page.getByRole('button', { name: '즐겨찾기', exact: true }).click();
  await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  const params = new URL(page.url()).searchParams;
  expect(params.get('q')).toBe('ChatGPT');
  expect(params.get('categoryId')).toBe(ai);
  expect(params.get('favorite')).toBe('true');
  expect(params.get('sort')).toBe('frequent');
  expect(params.get('keep')).toBe('yes');
  expect(new URL(page.url()).hash).toBe('#anchor');
  expect(rscSearchRequests).toEqual([]);
  await page.reload();
  await expect(input).toHaveValue('ChatGPT');
  await expect(page.getByLabel('정렬', { exact: true })).toHaveValue(
    'frequent',
  );
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(8);
  await expect(input).toHaveValue('');
  await expect(page.getByLabel('카테고리 필터')).toHaveValue('');
  await expect(page.getByLabel('정렬', { exact: true })).toHaveValue('default');
  await expect(page).toHaveURL('/links?keep=yes#anchor');
  await page.evaluate(() => {
    window.history.pushState(
      null,
      '',
      '/links?q=Figma&favorite=true&sort=smart',
    );
  });
  await expect(input).toHaveValue('Figma');
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  await page.goBack();
  await expect(input).toHaveValue('');
  await expect(page.getByTestId('link-item')).toHaveCount(8);
  expect(
    api.requests.some(
      (request) => new URL(request.url()).searchParams.get('q') === 'ChatGPT',
    ),
  ).toBe(true);
});
test('search clear preserves other conditions; uncategorized and category transitions retain favorite', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  state.links[0]!.categoryId = null;
  api.users.set(testUser.id, state);
  await page.goto(
    '/links?categoryId=uncategorized&favorite=true&sort=recent&q=ChatGPT',
  );
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  await page
    .getByRole('button', { name: '검색어 지우기', exact: true })
    .click();
  await expect(page.getByRole('searchbox')).toBeFocused();
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
  await page.getByLabel('카테고리 필터').selectOption(ai);
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('카테고리 필터').selectOption('uncategorized');
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('sort')).toBe('recent');
});
test('cold category registration passes pending UUID and returns to saved category; uncategorized is explicit', async ({
  page,
  context,
}) => {
  await installProductApi(context);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('http://127.0.0.1:54329/categories', async (route) => {
    await gate;
    await route.fallback();
  });
  await page.goto(`/links?categoryId=${ai}`);
  await expect(page.getByTestId('link-item')).toHaveCount(4);
  const registration = page
    .getByRole('link', { name: '링크 등록', exact: true })
    .first();
  await expect(registration).toHaveAttribute(
    'href',
    `/links/new?categoryId=${ai}&from=links`,
  );
  await registration.click();
  await expect(
    page.getByRole('button', { name: '링크 등록', exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.locator('#category')).toHaveValue(ai);
  await page.locator('#link-url').fill('https://example.test/ui14');
  await page.locator('#custom-title').fill('등록 컨텍스트');
  await page.locator('#category').selectOption('');
  await page.getByRole('button', { name: '링크 등록', exact: true }).click();
  await expect(page).toHaveURL('/links?categoryId=uncategorized');
  await expect(
    page.getByRole('link', { name: '등록 컨텍스트 열기', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: '링크 등록', exact: true })
    .first()
    .click();
  await expect(page.locator('#category')).toHaveValue('');
  await expect(page.locator('#initial-category-status')).toHaveCount(0);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page).toHaveURL('/links?categoryId=uncategorized');
  let releaseUncategorized = () => {};
  const uncategorizedGate = new Promise<void>((resolve) => {
    releaseUncategorized = resolve;
  });
  await page.route('http://127.0.0.1:54329/categories', async (route) => {
    await uncategorizedGate;
    await route.fallback();
  });
  await page.goto('/links?categoryId=uncategorized');
  await page
    .getByRole('link', { name: '링크 등록', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: '링크 등록', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page).toHaveURL('/links?categoryId=uncategorized');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  releaseUncategorized();
});
test('summary failure is not zero and retries independently; deletion refreshes total', async ({
  page,
}) => {
  let fail = true;
  await page.route('http://127.0.0.1:54329/categories/summary', (route) =>
    fail
      ? route.fulfill({ status: 503, headers: cors, json: {} })
      : route.fallback(),
  );
  await page.goto('/links');
  await expect(
    page.getByText('전체 링크 수를 불러오지 못했어요.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('전체 링크 0개', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('link-item')).toHaveCount(8);
  fail = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('전체 링크 8개', { exact: true })).toBeVisible();
  fail = true;
  await page
    .getByRole('button', { name: 'ChatGPT 즐겨찾기', exact: true })
    .click();
  await expect(
    page.getByText('전체 링크 수를 불러오지 못했어요.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('전체 링크 8개', { exact: true })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(
    page.getByText('전체 링크 수를 불러오지 못했어요.', { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '링크 삭제', exact: true })
    .click();
  await expect(page.getByText('전체 링크 7개', { exact: true })).toBeVisible();
});
test('header and empty-state import entry use existing importer on desktop and mobile', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  state.links = [];
  api.users.set(testUser.id, state);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/links');
    await expect(
      page.getByText('아직 링크가 없어요', { exact: true }),
    ).toBeVisible();
    if (width < 1024) {
      await page
        .getByRole('button', { name: '내 링크 더보기', exact: true })
        .click();
      await page
        .getByRole('menuitem', { name: '북마크 가져오기', exact: true })
        .click();
    } else
      await page
        .getByRole('group', { name: '링크 작업' })
        .getByRole('link', { name: '북마크 가져오기', exact: true })
        .click();
    await expect(page).toHaveURL('/links/import');
    await expect(page.locator('input[type=file]')).toHaveCount(1);
  }
});
test('Home shares title-only rows while legacy category metadata and preset picker remain unchanged', async ({
  page,
  browserName,
}) => {
  await presetApi(page, 1);
  const defaults = `${root}/${browserName}/default`;
  await mkdir(defaults, { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/categories');
    await page.getByRole('link', { name: 'AI 링크 보기', exact: true }).click();
    await expect(page).toHaveURL(`/links?categoryId=${ai}`);
    await expect(page.getByTestId('link-item')).toHaveCount(4);
    await page.screenshot({
      path: `${defaults}/category-entry-${width}.png`,
      animations: 'disabled',
    });
    await page.goto('/links');
    await expect(page.getByTestId('link-item')).toHaveCount(8);
    await page.screenshot({
      path: `${defaults}/links-${width}.png`,
      animations: 'disabled',
    });
    await page.goto('/');
    await expect(page.getByTestId('link-item')).toHaveCount(3);
    await page.screenshot({
      path: `${defaults}/home-${width}.png`,
      animations: 'disabled',
    });
  }
  await page.goto('/');
  await expect(page.getByTestId('link-item')).toHaveCount(3);
  await expect(page.getByTestId('link-item').locator('img')).toHaveCount(0);
  await expect(
    page.getByTestId('link-item').getByText('chatgpt.com', { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  await page.getByRole('button', { name: '편집', exact: true }).click();
  await page.getByRole('button', { name: '+ 링크 추가', exact: true }).click();
  await page
    .getByRole('searchbox', { name: '포함할 링크 검색', exact: true })
    .fill('ChatGPT');
  await expect(
    page.getByRole('list', { name: '등록된 링크 선택' }).getByRole('listitem'),
  ).toHaveCount(1);
  await expect(
    page.getByRole('list', { name: '등록된 링크 선택' }),
  ).toContainText('ChatGPT');
  await page.getByRole('button', { name: /^선택 완료/ }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.goto(`/category/${ai}`);
  await expect(page.getByTestId('link-item')).toHaveCount(4);
  await expect(
    page.getByRole('list', { name: '링크 목록', exact: true }),
  ).toContainText('chatgpt.com');
  await expect(
    page.getByRole('tab', { name: '즐겨찾기', exact: true }),
  ).toBeVisible();
});

test('owned total is independent of loaded and filtered rows; reset reuses matching pages and detail keeps scroll', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  const seed = state.links[0]!;
  state.links = Array.from({ length: 45 }, (_, i) => ({
    ...seed,
    id: fixtureId(`ui14-page-${i}`),
    title: `Saved ${i}`,
    isFavorite: i % 3 === 0,
  }));
  api.users.set(testUser.id, state);
  await page.goto('/links');
  await expect(page.getByText('전체 링크 45개', { exact: true })).toBeVisible();
  await expect(page.getByTestId('link-item')).toHaveCount(20);
  await page.getByRole('button', { name: '더 보기', exact: true }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(40);
  await page.getByRole('button', { name: '즐겨찾기', exact: true }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(15);
  await expect(page.getByText('전체 링크 45개', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(40);
  await expect(page).toHaveURL('/links');
  const detail = page
    .getByTestId('link-item')
    .nth(28)
    .getByRole('button', { name: /상세 보기/ });
  await detail.scrollIntoViewIfNeeded();
  await detail.focus();
  const y = await page.evaluate(() => scrollY);
  await detail.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).toBeFocused();
  await expect(page.getByTestId('link-item')).toHaveCount(40);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await page.getByRole('button', { name: '더 보기', exact: true }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(45);
  await expect(
    page.getByRole('button', { name: '더 보기', exact: true }),
  ).toHaveCount(0);
});
