import { test, expect, authenticate, testUser } from './auth-fixture';
import { initialProduct, installProductApi } from './product-fixture';
import { openCategoryCreate } from './category-ui';
import type { BrowserContext, Page } from '@playwright/test';
const endpoint = 'http://127.0.0.1:54329/categories';
const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
async function setup(context: BrowserContext, empty = true) {
  const api = await installProductApi(context);
  const state = initialProduct();
  if (empty) {
    state.categories = [];
    state.links = [];
  }
  api.users.set(testUser.id, state);
  return { api, state };
}
async function create(page: Page, name: string) {
  await openCategoryCreate(page);
  await page.getByLabel('카테고리 이름', { exact: true }).fill(name);
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
// WO-UI-11 replaces the retired multi-selection Bottom Sheet. The same 18
// cases now cover explicit creation, draft/focus safety, failures and widths.
test('explicit category creation consumes intent, saves and returns Home without categories', async ({
  page,
  context,
}) => {
  const { api } = await setup(context);
  await page.goto('/categories?action=create');
  await expect(page.getByLabel('카테고리 이름')).toBeFocused();
  await expect(page).toHaveURL('/categories');
  await page.getByLabel('카테고리 이름').fill('개인 프로젝트');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }),
  ).toContainText('개인 프로젝트');
  expect(
    api.requests
      .filter((r) => r.method() === 'POST')
      .map((r) => r.postDataJSON()),
  ).toEqual([{ name: '개인 프로젝트', sortOrder: 0 }]);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '홈', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: '카테고리', exact: true }),
  ).toHaveCount(0);
});
test('create intent preserves query/hash and never replays after reload or back', async ({
  page,
  context,
}) => {
  await setup(context);
  await page.goto('/');
  await page.goto('/categories?action=create&keep=yes#category-name');
  await expect(page).toHaveURL('/categories?keep=yes#category-name');
  await expect(page.getByLabel('카테고리 이름')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack();
  await page.goForward();
  await expect(page).toHaveURL('/categories?keep=yes#category-name');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('Home loading and background refetch never automatically open category setup', async ({
  page,
  context,
}) => {
  await setup(context);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await gate;
    await route.fallback();
  });
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  release();
  await expect(page.getByText('즐겨찾기한 링크가 없어요.')).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(16000);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('failed background reconciliation keeps a confirmed creation and retries only reads', async ({
  page,
  context,
}) => {
  const { state, api } = await setup(context);
  let failRead = false;
  await page.route(endpoint, (route) =>
    route.request().method() === 'GET' && failRead
      ? route.fulfill({ status: 503, headers, json: {} })
      : route.fallback(),
  );
  await page.goto('/categories');
  await openCategoryCreate(page);
  await page.getByLabel('카테고리 이름').fill('개발');
  failRead = true;
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.categories.map((row) => row.name)).toEqual(['개발']);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('잠시');
  failRead = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(
    page.getByRole('link', { name: '개발 링크 보기' }),
  ).toBeVisible();
  expect(api.requests.filter((r) => r.method() === 'POST')).toHaveLength(1);
});
test('empty Home remains simple; explicit editor cancellation restores focus and clears draft', async ({
  page,
  context,
}) => {
  await setup(context);
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '카테고리', exact: true })
    .click();
  await openCategoryCreate(page);
  await page.getByLabel('카테고리 이름').fill('저장 안 함');
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '카테고리 추가', exact: true }),
  ).toBeFocused();
  await openCategoryCreate(page);
  await expect(page.getByLabel('카테고리 이름')).toHaveValue('');
});
test('existing category data and query errors never open an unsolicited editor', async ({
  page,
  context,
}) => {
  await setup(context, false);
  await page.goto('/categories');
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.route(endpoint, (route) =>
    route.fulfill({ status: 503, headers, json: {} }),
  );
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('잠시');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('name trim, duplicate prevention and appended order use the existing creation contract', async ({
  page,
  context,
}) => {
  const { state, api } = await setup(context, false);
  await page.goto('/categories');
  const max = Math.max(...state.categories.map((row) => row.sortOrder));
  await create(page, '  직접 추가  ');
  expect(state.categories.at(-1)?.name).toBe('직접 추가');
  expect(state.categories.at(-1)?.sortOrder).toBe(max + 1);
  await openCategoryCreate(page);
  await page.getByLabel('카테고리 이름').fill(' ai ');
  await expect(
    page.getByRole('button', { name: '추가', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '같은 이름',
  );
  expect(api.requests.filter((r) => r.method() === 'POST')).toHaveLength(1);
});
test('failed create retry retains its name and original next position without duplicate successes', async ({
  page,
  context,
}) => {
  const { state, api } = await setup(context, false);
  let fail = true;
  await page.route(endpoint, (route) =>
    route.request().method() === 'POST' && fail
      ? route.fulfill({ status: 503, headers, json: {} })
      : route.fallback(),
  );
  await page.goto('/categories');
  await openCategoryCreate(page);
  await page.getByLabel('카테고리 이름').fill('재시도');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '잠시',
  );
  await expect(page.getByLabel('카테고리 이름')).toHaveValue('재시도');
  fail = false;
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.categories.filter((row) => row.name === '재시도')).toHaveLength(
    1,
  );
  expect(api.requests.filter((r) => r.method() === 'POST')).toHaveLength(1);
});
for (const mode of ['lost', 'conflict'] as const)
  test(`${mode} response never automatically repeats a committed POST and reloaded data prevents duplicates`, async ({
    page,
    context,
  }) => {
    const { state } = await setup(context);
    let writes = 0;
    await page.route(endpoint, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      writes++;
      state.categories.push({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: '개발',
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return mode === 'lost'
        ? route.abort()
        : route.fulfill({ status: 409, headers, json: {} });
    });
    await page.goto('/categories');
    await openCategoryCreate(page);
    await page.getByLabel('카테고리 이름').fill('개발');
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('카테고리 이름')).toHaveValue('개발');
    expect(writes).toBe(1);
    await page.reload();
    await expect(
      page.getByRole('link', { name: '개발 링크 보기' }),
    ).toBeVisible();
    await openCategoryCreate(page);
    await page.getByLabel('카테고리 이름').fill('개발');
    await expect(
      page.getByRole('button', { name: '추가', exact: true }),
    ).toBeDisabled();
    expect(writes).toBe(1);
  });
test('saving blocks X, ESC, overlay, cancellation and duplicate form submissions', async ({
  page,
  context,
}) => {
  const { api } = await setup(context);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    if (route.request().method() === 'POST') await gate;
    await route.fallback();
  });
  await page.goto('/categories');
  await openCategoryCreate(page);
  await page.getByLabel('카테고리 이름').fill('저장 중');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '취소', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '닫기', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.locator('#category-editor').dispatchEvent('submit');
  if (page.viewportSize()!.width >= 1024) await page.mouse.click(10, 100);
  await expect(page.getByRole('dialog')).toBeVisible();
  release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(api.requests.filter((r) => r.method() === 'POST')).toHaveLength(1);
});
test('account change discards category editor draft and isolates categories/counts', async ({
  page,
  context,
}) => {
  const { api } = await setup(context);
  await page.goto('/categories');
  await openCategoryCreate(page);
  await page.getByLabel('카테고리 이름').fill('첫 계정 초안');
  await authenticate(context, false, 'alternate');
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openCategoryCreate(page);
  await expect(page.getByLabel('카테고리 이름')).toHaveValue('');
  expect(api.users.get(testUser.id)?.categories).toHaveLength(0);
});
for (const width of [320, 375, 390, 430, 512, 1440])
  test(`category AppSheet fits ${width}px with accessible actions and short-height scroll`, async ({
    page,
    context,
  }) => {
    await setup(context);
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/categories');
    await openCategoryCreate(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect((await dialog.boundingBox())?.width).toBeCloseTo(
      width < 1024 ? width : 512,
    );
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.getByLabel('카테고리 이름').fill('키보드 추가');
    await page.setViewportSize({ width, height: 360 });
    await expect(
      dialog.getByRole('button', { name: '추가', exact: true }),
    ).toBeInViewport();
    await expect(
      dialog.getByRole('button', { name: '취소', exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: `artifacts/wo-ui-11/editor-short-${width}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
