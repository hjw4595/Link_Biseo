import { selectLinkFilter, registerLink } from './link-filter-helper';
import { test, expect, testUser } from './auth-fixture';
import { installProductApi, initialProduct } from './product-fixture';
import { categoryMenu, openCategoryCreate } from './category-ui';
import { isCategorySummaryResponse } from '../src/contracts/categories';
import {
  expectLayoutWidth,
  expectClearOfNavigation,
} from './layout-assertions';
import { mkdir, writeFile } from 'node:fs/promises';
const apiUrl = 'http://127.0.0.1:54329';
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const root = 'artifacts/wo-ui-11';
test('summary runtime validation rejects malformed, duplicate, unsafe and inconsistent counts', () => {
  const id = initialProduct().categories[0]!.id;
  const good = {
    items: [{ id, linkCount: 2 }],
    uncategorizedCount: 1,
    totalLinkCount: 3,
  };
  expect(isCategorySummaryResponse(good)).toBe(true);
  expect(
    isCategorySummaryResponse({
      items: [],
      uncategorizedCount: 0,
      totalLinkCount: 0,
    }),
  ).toBe(true);
  for (const bad of [
    null,
    [],
    {},
    { ...good, items: [{ id: 'bad', linkCount: 2 }] },
    { ...good, items: [...good.items, ...good.items] },
    { ...good, totalLinkCount: 4 },
    { ...good, uncategorizedCount: -1 },
    { ...good, totalLinkCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...good, items: [{ id, linkCount: '2' }] },
    { ...good, items: [{ id, linkCount: 1.5 }] },
  ])
    expect(isCategorySummaryResponse(bad)).toBe(false);
});
test('counts include every saved link, empty categories and separate uncategorized; deletion preserves IDs and total', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  state.links.push({
    ...state.links[0]!,
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoryId: null,
  });
  api.users.set(testUser.id, state);
  const category = state.categories[0]!;
  const ids = state.links.map((row) => row.id).sort();
  const total = state.links.length;
  await page.goto('/categories');
  const card = page
    .getByRole('list', { name: '저장된 카테고리' })
    .locator('li')
    .filter({
      has: page.getByRole('link', {
        name: `${category.name} 링크 보기`,
        exact: true,
      }),
    });
  await expect(card).toContainText(
    `링크 ${state.links.filter((row) => row.categoryId === category.id).length}개`,
  );
  await expect(
    page.getByRole('link', { name: '미분류 링크 보기' }),
  ).toContainText('링크 1개');
  await expect(
    page.getByRole('link', { name: '나중에 읽을 글 링크 보기' }),
  ).toContainText('링크 0개');
  const previousUncategorized = state.links.filter(
    (row) => row.categoryId === null || row.categoryId === category.id,
  ).length;
  await categoryMenu(page, category.name, '삭제');
  await expect(page.getByRole('alertdialog')).toContainText(
    '포함된 링크는 미분류로 이동해요.',
  );
  await expect(
    page.getByRole('button', { name: '취소', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: '카테고리 삭제', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: '미분류 링크 보기' }),
  ).toContainText(`링크 ${previousUncategorized}개`);
  expect(state.links.map((row) => row.id).sort()).toEqual(ids);
  expect(state.links).toHaveLength(total);
  expect(state.links.some((row) => row.categoryId === category.id)).toBe(false);
  await expect(
    page.getByRole('button', { name: '카테고리 추가', exact: true }),
  ).toBeFocused();
  await page.getByRole('link', { name: '미분류 링크 보기' }).click();
  await expect(page).toHaveURL('/links?categoryId=uncategorized');
  await expect(page.getByLabel('카테고리 필터')).toHaveValue('uncategorized');
  await expect(page.getByTestId('link-item')).toHaveCount(
    previousUncategorized,
  );
});
test('reorder is local until one completion request, locks management, cancels and persists after reload', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.goto('/categories');
  const original = initialProduct().categories.map((row) => row.name);
  const writes = () =>
    api.requests.filter(
      (r) =>
        r.method() === 'PATCH' &&
        new URL(r.url()).pathname === '/categories/reorder',
    );
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '카테고리 추가', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'AI 관리', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: `${original[0]} 위로 이동` }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: `${original.at(-1)} 아래로 이동` }),
  ).toBeDisabled();
  await expect(
    page.getByRole('list', { name: '카테고리 순서' }),
  ).not.toContainText('미분류');
  await page
    .getByRole('button', { name: 'AI 아래로 이동', exact: true })
    .click();
  expect(writes()).toHaveLength(0);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }).locator('li'),
  ).toContainText(original);
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  expect(writes()).toHaveLength(0);
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: 'AI 아래로 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }),
  ).toBeVisible();
  expect(writes()).toHaveLength(1);
  const expected = [...original];
  [expected[0], expected[1]] = [expected[1]!, expected[0]!];
  await page.reload();
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }).locator('li'),
  ).toContainText(expected);
});
test('reorder failure retains draft; retry sends one full permutation and blocks repeated saves while pending', async ({
  page,
  context,
}) => {
  await installProductApi(context);
  let writes = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${apiUrl}/categories/reorder`, async (route) => {
    writes++;
    if (writes === 1)
      return route.fulfill({ status: 503, json: {}, headers: cors });
    await gate;
    await route.fallback();
  });
  await page.goto('/categories');
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: '디자인 위로 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('잠시');
  await expect(
    page.getByRole('list', { name: '카테고리 순서' }).locator('li').first(),
  ).toContainText('디자인');
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '완료', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '취소', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'AI 위로 이동', exact: true }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }),
  ).toBeVisible();
  expect(writes).toBe(2);
});
test('rename error retains draft, unchanged name is disabled, retry changes only name and restores trigger focus', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  let fail = true;
  await page.route(`${apiUrl}/categories/*`, (route) =>
    route.request().method() === 'PATCH' && fail
      ? route.fulfill({ status: 503, json: {}, headers: cors })
      : route.fallback(),
  );
  await page.goto('/categories');
  await categoryMenu(page, 'AI', '이름 변경');
  await expect(page.getByLabel('카테고리 이름')).toHaveValue('AI');
  await expect(
    page.getByRole('button', { name: '변경 저장', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('카테고리 이름').fill('인공지능');
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '잠시',
  );
  await expect(page.getByLabel('카테고리 이름')).toHaveValue('인공지능');
  fail = false;
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '인공지능 관리', exact: true }),
  ).toBeFocused();
  const write = api.requests.find((r) => r.method() === 'PATCH');
  expect(write?.postDataJSON()).toEqual({ name: '인공지능' });
});
test('delete failure remains cancelable and retryable without touching links', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  let fail = true;
  await page.route(`${apiUrl}/categories/*`, (route) =>
    route.request().method() === 'DELETE' && fail
      ? route.fulfill({ status: 503, json: {}, headers: cors })
      : route.fallback(),
  );
  await page.goto('/categories');
  await categoryMenu(page, 'AI', '삭제');
  await page
    .getByRole('button', { name: '카테고리 삭제', exact: true })
    .click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText(
    '잠시',
  );
  expect(api.users.get(testUser.id)?.links).toHaveLength(8);
  fail = false;
  await page
    .getByRole('button', { name: '카테고리 삭제', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(api.users.get(testUser.id)?.links).toHaveLength(8);
});
test('category ID URL survives rename and reload and composes with search, favorite and sort', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.goto('/categories');
  await page.getByRole('link', { name: 'AI 링크 보기', exact: true }).click();
  const id = initialProduct().categories[0]!.id;
  await expect(page).toHaveURL(`/links?categoryId=${id}`);
  await expect(page.getByTestId('link-item')).toHaveCount(4);
  await page.getByRole('searchbox').fill('ChatGPT');
  await selectLinkFilter(page, 'favorites');
  await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  await page.getByLabel('카테고리 필터').selectOption('');
  await expect(page.getByRole('searchbox')).toHaveValue('ChatGPT');
  await expect(page.getByLabel('정렬', { exact: true })).toHaveValue(
    'frequent',
  );
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  api.users.get(testUser.id)!.categories[0]!.name = 'AI 이름 변경';
  await page.goto(`/links?categoryId=${id}&q=ChatGPT&favorite=true`);
  await page.reload();
  await expect(page.getByLabel('카테고리 필터')).toHaveValue(id);
  await expect(page.locator('#link-category-filter option:checked')).toHaveText(
    'AI 이름 변경',
  );
  await expect(page.getByTestId('link-item')).toHaveCount(1);
});
test('missing category ID remains explicit and can reset to all links', async ({
  page,
}) => {
  await page.goto('/links?categoryId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '사용할 수 없는 카테고리',
  );
  await page.getByLabel('카테고리 필터').selectOption('');
  await expect(page).toHaveURL('/links');
  await expect(page.getByTestId('link-item')).toHaveCount(8);
});
test('count failure never pretends zero or hides cached categories and retries independently', async ({
  page,
}) => {
  let fail = true;
  await page.route(`${apiUrl}/categories/summary`, (route) =>
    fail
      ? route.fulfill({ status: 503, headers: cors, json: {} })
      : route.fallback(),
  );
  await page.goto('/categories');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '링크 수',
  );
  await expect(page.getByRole('link', { name: 'AI 링크 보기' })).toContainText(
    '링크 수 확인 불가',
  );
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('link', { name: 'AI 링크 보기' })).toContainText(
    '링크 4개',
  );
});
for (const width of [320, 390, 512, 768, 1024, 1440, 1920])
  test(`category management all modes and filtered navigation at ${width}px`, async ({
    page,
    context,
    browserName,
  }) => {
    const captureRoot =
      browserName === 'chromium' ? root : `${root}/${browserName}`;
    const api = await installProductApi(context);
    const state = initialProduct();
    state.categories[1]!.name = '긴카테고리이름English日本語'.repeat(5);
    api.users.set(testUser.id, state);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mkdir(`${captureRoot}/screenshots`, { recursive: true });
    const capture = async (name: string) => {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `${captureRoot}/screenshots/${width}-${name}.png`,
        animations: 'disabled',
        fullPage: true,
      });
    };
    await page.goto('/categories');
    const list = page.getByRole('list', { name: '저장된 카테고리' });
    await expect(list.locator(':scope > li')).toHaveCount(6);
    await expect(
      page.getByRole('link', { name: 'AI 링크 보기' }),
    ).toContainText('링크 4개');
    const metrics = await list.evaluate((el) => ({
      columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
      width: el.getBoundingClientRect().width,
    }));
    expect(metrics.columns).toBe(width >= 1024 ? 2 : 1);
    await expectLayoutWidth(page);
    await capture('categories');
    const menu = page.getByRole('button', { name: 'AI 관리', exact: true });
    const menuBox = await menu.boundingBox();
    expect(menuBox!.width).toBeGreaterThanOrEqual(44);
    expect(menuBox!.height).toBeGreaterThanOrEqual(44);
    await menu.click();
    await expect(page.getByRole('menu')).toBeInViewport();
    await capture('menu');
    await page.keyboard.press('Escape');
    await openCategoryCreate(page);
    await expect(page.getByLabel('카테고리 이름')).toBeFocused();
    await capture('create');
    expect(
      await page
        .locator('[aria-label="저장된 카테고리"]')
        .evaluate((el) => el.getBoundingClientRect().width),
    ).toBe(metrics.width);
    const sheet = await page.getByRole('dialog').boundingBox();
    expect(sheet?.width).toBeCloseTo(width < 1024 ? width : 512);
    expect(sheet?.x).toBeCloseTo(width < 1024 ? 0 : width - 512);
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: '카테고리 추가', exact: true }),
    ).toBeFocused();
    await categoryMenu(page, 'AI', '이름 변경');
    await expect(page.getByLabel('카테고리 이름')).toHaveValue('AI');
    await capture('rename');
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(menu).toBeFocused();
    if (width >= 1024) {
      await openCategoryCreate(page);
      await page.getByLabel('카테고리 이름').fill('저장하지 않은 이름');
      await page.mouse.click(10, 140);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: '카테고리 추가', exact: true }),
      ).toBeFocused();
    }
    await categoryMenu(page, 'AI', '삭제');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await capture('delete');
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    await page.getByRole('button', { name: '순서 변경', exact: true }).click();
    await expect(
      page.getByRole('list', { name: '카테고리 순서' }),
    ).toBeVisible();
    await capture('reorder');
    const rows = await page
      .getByRole('list', { name: '카테고리 순서' })
      .locator('li')
      .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().x));
    expect(new Set(rows).size).toBe(1);
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectClearOfNavigation(
      page,
      page.getByRole('link', { name: '미분류 링크 보기' }),
    );
    await page.screenshot({
      path: `${captureRoot}/screenshots/${width}-categories-bottom.png`,
      animations: 'disabled',
    });
    await page.getByRole('link', { name: 'AI 링크 보기', exact: true }).click();
    await expect(page.getByTestId('link-item')).toHaveCount(4);
    await capture('filtered-links');
    await page.goto('/');
    await expect(page.getByTestId('link-item')).toHaveCount(3);
    await expect(page.locator('[aria-labelledby="home-heading"]')).toHaveCount(
      0,
    );
    await capture('home-after');
    await writeFile(
      `${captureRoot}/screenshots/${width}-metrics.json`,
      JSON.stringify(
        {
          kind: 'Actual React UI / mocked HTTP API',
          width,
          categories: metrics,
          sheet,
        },
        null,
        2,
      ),
    );
  });

test('blank and overlong names cannot write; valid Unicode names preserve all code points', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  state.categories[0]!.name = 'İ';
  api.users.set(testUser.id, state);
  await page.goto('/categories');
  await openCategoryCreate(page);
  const input = page.getByLabel('카테고리 이름');
  const submit = page.getByRole('button', { name: '추가', exact: true });
  await input.fill('   ');
  await expect(submit).toBeDisabled();
  await input.fill('가'.repeat(101));
  await expect(submit).toBeDisabled();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '1~100자',
  );
  expect(api.requests.filter((r) => r.method() === 'POST')).toHaveLength(0);
  await input.fill('😀'.repeat(100));
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(api.users.get(testUser.id)?.categories.at(-1)?.name).toBe(
    '😀'.repeat(100),
  );
  await openCategoryCreate(page);
  await input.fill('i\u0307');
  // JS lower('İ') === 'i + combining dot', while database locale rules may
  // differ. Leave that decision to the existing server uniqueness validation.
  await expect(submit).toBeEnabled();
});
test('background category refresh retains cards and exposes a retry without replacing good data', async ({
  page,
  context,
}) => {
  await installProductApi(context);
  await page.goto('/categories');
  await expect(
    page.getByRole('link', { name: 'AI 링크 보기', exact: true }),
  ).toContainText('링크 4개');
  const identity = await page
    .getByRole('link', { name: 'AI 링크 보기', exact: true })
    .elementHandle();
  await page.route(`${apiUrl}/categories`, (route) =>
    route.fulfill({ status: 503, headers: cors, json: {} }),
  );
  await page.clock.install();
  await page.clock.fastForward(16000);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('main').getByRole('alert')).toContainText('잠시');
  expect(await identity?.evaluate((el) => el.isConnected)).toBe(true);
  await expect(
    page.getByRole('link', { name: 'AI 링크 보기', exact: true }),
  ).toContainText('링크 4개');
  await expect(page.getByText('6개 카테고리')).toBeVisible();
});
test('reorder conflict keeps draft and explicitly reloads a changed server membership before saving', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  let writes = 0;
  await page.route(`${apiUrl}/categories/reorder`, (route) => {
    writes++;
    if (writes === 1) {
      const state = api.users.get(testUser.id)!;
      state.categories = state.categories.filter(
        (row) => row.name !== '나중에 읽을 글',
      );
      return route.fulfill({ status: 409, headers: cors, json: {} });
    }
    return route.fallback();
  });
  await page.goto('/categories');
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: 'AI 아래로 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '변경됐어요',
  );
  await expect(
    page.getByRole('list', { name: '카테고리 순서' }).locator('li').first(),
  ).toContainText('디자인');
  await page
    .getByRole('button', { name: '목록 다시 불러오기', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '완료', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '최신 목록으로 다시 시작', exact: true })
    .click();
  await expect(
    page.getByRole('list', { name: '카테고리 순서' }).locator('li'),
  ).toHaveCount(5);
  await page
    .getByRole('button', { name: 'AI 아래로 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }),
  ).toBeVisible();
  expect(writes).toBe(2);
});
test('category counts invalidate across link registration, category edit and link deletion in the same session', async ({
  page,
  context,
}) => {
  await installProductApi(context);
  await page.goto('/categories');
  await expect(
    page.getByRole('link', { name: 'AI 링크 보기', exact: true }),
  ).toContainText('링크 4개');
  const nav = (name: string) =>
    page.getByRole('navigation').getByRole('link', { name, exact: true });
  await nav('내 링크').click();
  await registerLink(page);
  await page.locator('#link-url').fill('https://example.test/wo-ui11');
  await page.locator('#custom-title').fill('개수 갱신 검증');
  await page
    .locator('#category')
    .selectOption(initialProduct().categories[0]!.id);
  await page.getByRole('button', { name: '링크 등록', exact: true }).click();
  await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('heading', { name: '개수 갱신 검증', exact: true }),
  ).toBeVisible();
  await nav('카테고리').click();
  await expect(
    page.getByRole('link', { name: 'AI 링크 보기', exact: true }),
  ).toContainText('링크 5개');
  await nav('내 링크').click();
  await page.getByRole('searchbox').fill('개수 갱신 검증');
  await page
    .getByRole('button', { name: '개수 갱신 검증 상세 보기', exact: true })
    .click();
  await page.getByRole('button', { name: '정보 수정', exact: true }).click();
  await page.locator('#edit-category').selectOption('');
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '정보 수정', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await nav('카테고리').click();
  await expect(
    page.getByRole('link', { name: 'AI 링크 보기', exact: true }),
  ).toContainText('링크 4개');
  await expect(
    page.getByRole('link', { name: '미분류 링크 보기' }),
  ).toContainText('링크 1개');
  await nav('내 링크').click();
  await page.getByRole('searchbox').fill('개수 갱신 검증');
  await page
    .getByRole('button', { name: '개수 갱신 검증 상세 보기', exact: true })
    .click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '링크 삭제', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await nav('카테고리').click();
  await expect(
    page.getByRole('link', { name: '미분류 링크 보기' }),
  ).toContainText('링크 0개');
});
