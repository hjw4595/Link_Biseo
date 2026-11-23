import { test, expect, testUser } from './auth-fixture';
import {
  fixtureId,
  initialProduct,
  installProductApi,
} from './product-fixture';
import { mockExtension, openCalls } from './extension-helper';

// Full Chromium is required for native middle-click tab creation.
test.use({ channel: 'chromium' });

test('empty category registration preserves context and clearing search keeps filters', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  const category = state.categories[0]!;
  state.links = state.links.filter((link) => link.categoryId !== category.id);
  api.users.set(testUser.id, state);
  await page.goto(`/links?categoryId=${category.id}`);
  await page
    .getByRole('link', { name: `${category.name}에 링크 등록`, exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('combobox')).toHaveValue(
    category.id,
  );
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByLabel('카테고리 필터')).toHaveValue(category.id);
  await expect(page).toHaveURL(`/links?categoryId=${category.id}`);
  await expect(
    page.getByRole('link', {
      name: `${category.name}에 링크 등록`,
      exact: true,
    }),
  ).toBeFocused();
  await page.getByRole('button', { name: '즐겨찾기', exact: true }).click();
  await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
  await page.getByRole('searchbox').fill('no-ux-results');
  await expect(
    page.getByText('검색 결과가 없어요.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '검색어 지우기', exact: true })
    .filter({ hasText: '검색어 지우기' })
    .click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByLabel('카테고리 필터')).toHaveValue(category.id);
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('정렬', { exact: true })).toHaveValue(
    'frequent',
  );
  await expect(page).toHaveURL(
    `/links?categoryId=${category.id}&favorite=true&sort=frequent`,
  );
});

test('native opens share a one-second cooldown across controls and recover afterwards', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  state.links.find((link) => link.id === fixtureId('chatgpt'))!.url =
    'https://ux-destination.example.test/open';
  api.users.set(testUser.id, state);
  await context.route('https://ux-destination.example.test/**', (route) =>
    route.fulfill({ body: 'Test destination' }),
  );
  await page.goto(`/links/${fixtureId('chatgpt')}`);
  const opens = () =>
    api.requests.filter((r) =>
      r.url().endsWith(`/links/${fixtureId('chatgpt')}/open`),
    );
  await page
    .getByRole('link', { name: '새 탭에서 열기', exact: true })
    .dblclick();
  await page
    .getByRole('link', { name: '링크 열기', exact: true })
    .click({ modifiers: ['Control'] });
  await expect.poll(() => opens().length).toBe(1);
  await expect.poll(() => context.pages().length).toBe(2);
  await page.waitForTimeout(1100);
  await page
    .getByRole('link', { name: '새 탭에서 열기', exact: true })
    .click({ button: 'middle' });
  await page
    .getByRole('link', { name: '새 탭에서 열기', exact: true })
    .click({ button: 'middle' });
  await expect.poll(() => opens().length).toBe(2);
  await expect.poll(() => context.pages().length).toBe(3);
  for (const popup of context.pages().filter((item) => item !== page))
    await popup.close();
});

test('pending ordinary opens reject rapid repeats but allow another link', async ({
  page,
  context,
}) => {
  await installProductApi(context);
  const requests: string[] = [];
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route(
    /^http:\/\/127\.0\.0\.1:54329\/links\/[^/]+\/open$/,
    async (route) => {
      requests.push(route.request().url());
      await gate;
      await route
        .fulfill({
          headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
          json: {
            url: 'https://ux-destination.example.test/open',
            openedAt: new Date().toISOString(),
          },
        })
        .catch(() => {});
    },
  );
  try {
    await page.goto('/links');
    await page
      .getByRole('link', { name: 'ChatGPT 열기', exact: true })
      .dblclick();
    await page.getByRole('link', { name: 'Figma 열기', exact: true }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(
      requests.filter((url) => url.includes(fixtureId('chatgpt'))),
    ).toHaveLength(1);
    expect(
      requests.filter((url) => url.includes(fixtureId('figma'))),
    ).toHaveLength(1);
    await expect(page).toHaveURL('/links');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '설정', exact: true })
      .click();
    await expect(page).toHaveURL('/settings');
  } finally {
    release();
  }
});

test('secret double activation dispatches and records once per cooldown', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await mockExtension(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/links');
  await page.getByRole('switch', { name: '시크릿 실행 모드' }).click();
  await expect(
    page.getByRole('switch', { name: '시크릿 실행 모드' }),
  ).toHaveAttribute('aria-checked', 'true');
  const link = page.getByRole('button', { name: 'ChatGPT 열기', exact: true });
  await link.dblclick();
  await expect.poll(async () => (await openCalls(page)).length).toBe(1);
  await expect
    .poll(() => api.requests.filter((r) => r.url().endsWith('/open')).length)
    .toBe(1);
  await page.waitForTimeout(1100);
  await link.press('Enter');
  await expect.poll(async () => (await openCalls(page)).length).toBe(2);
  await expect
    .poll(() => api.requests.filter((r) => r.url().endsWith('/open')).length)
    .toBe(2);
  expect(context.pages()).toHaveLength(1);
});
