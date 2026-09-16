import { selectLinkFilter } from './link-filter-helper';
import { categoryMenu } from './category-ui';
import { editLinkInfo, requestLinkDeletion } from './link-actions-helper';
import { test, expect, testUser, authenticate } from './auth-fixture';
import { mkdir } from 'node:fs/promises';
import {
  fixtureId,
  initialProduct,
  installProductApi,
} from './product-fixture';

const api = 'http://127.0.0.1:54329';
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };

for (const width of [320, 375, 390, 430, 512, 1440])
  test(`API loading/error/retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let attempts = 0;
    await page.route(`${api}/links?**`, async (route) => {
      attempts++;
      if (attempts === 1) {
        await gate;
        return route.fulfill({ headers: cors, status: 503, json: {} });
      }
      return route.fulfill({
        headers: cors,
        json: { items: [], nextCursor: null },
      });
    });
    await page.goto('/links');
    await expect(
      page.getByRole('status').filter({ hasText: '링크를 불러오고 있어요.' }),
    ).toBeVisible();
    const directory = 'artifacts/wo-003/screenshots';
    await mkdir(directory, { recursive: true });
    await page.screenshot({
      path: `${directory}/loading-${width}.png`,
      fullPage: true,
    });
    release();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await page.screenshot({
      path: `${directory}/error-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('navigation', { name: '주요 메뉴' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(
      page.getByRole('link', { name: '링크 등록', exact: true }).last(),
    ).toBeVisible();
    expect(attempts).toBe(2);
  });

test('account switch cancels a late previous-user result', async ({
  page,
  context,
}) => {
  const row = initialProduct().links[0];
  if (!row) throw new Error('Missing fixture');
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let waiting = false;
  await page.route(`${api}/links?**`, async (route) => {
    const token = route
      .request()
      .headers()
      .authorization?.split(' ')[1]
      ?.split('.')[1];
    const oldUser =
      token && Buffer.from(token, 'base64url').toString().includes(testUser.id);
    if (!oldUser)
      return route.fulfill({
        headers: cors,
        json: { items: [], nextCursor: null },
      });
    waiting = true;
    await gate;
    await route
      .fulfill({
        headers: cors,
        json: {
          items: [{ ...row, title: 'Previous account private title' }],
          nextCursor: null,
        },
      })
      .catch(() => {});
  });
  await page.goto('/links');
  await expect.poll(() => waiting).toBe(true);
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('아직 링크가 없어요')).toBeVisible();
  release();
  await expect(page.getByText('Previous account private title')).toHaveCount(0);
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await expect(page.getByText('second@example.test')).toBeVisible();
});

test('current-tab opening never calls window.open and recording failure stays recoverable', async ({
  page,
}) => {
  let calls = 0;
  await page.route(`${api}/links/*/open`, (route) => {
    calls++;
    return route.fulfill({ headers: cors, status: 500, json: {} });
  });
  await page.goto(`/links/${fixtureId('chatgpt')}`);
  await page.evaluate(() => {
    window.open = () => null;
  });
  await page.getByRole('link', { name: '링크 열기', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '사용 기록',
  );
  await expect(
    page.getByRole('link', { name: '기록 없이 열기' }),
  ).toBeVisible();
  expect(calls).toBe(1);
});

test('overlapping pages deduplicate, null metadata falls back without polling', async ({
  page,
}) => {
  const row = initialProduct().links[0];
  if (!row) throw new Error('Missing fixture');
  let calls = 0;
  await page.route(`${api}/links?**`, (route) => {
    calls++;
    const next = new URL(route.request().url()).searchParams.has('cursor');
    const first = {
      ...row,
      title: row.domain,
      description: null,
      faviconUrl: 'javascript:alert(1)',
    };
    return route.fulfill({
      headers: cors,
      json: {
        items: next
          ? [first, { ...first, id: fixtureId('extra'), title: 'Next link' }]
          : [first],
        nextCursor: next ? null : '1.signature',
      },
    });
  });
  await page.goto('/links');
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  await expect(page.getByTestId('link-item').locator('img')).toHaveCount(0);
  await page.getByRole('button', { name: '더 보기', exact: true }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(2);
  expect(calls).toBe(2);
});

test('link creation persists, edit refreshes list, category deletion preserves uncategorized links', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  await page.goto(`/links/new?categoryId=${fixtureId('ai')}`);
  await expect(page.locator('#category')).toHaveValue(fixtureId('ai'));
  await page.locator('#link-url').fill('https://example.org/wo003');
  await page.locator('#custom-title').fill('WO003 저장 테스트');
  await page.getByRole('button', { name: '+ 설명 추가', exact: true }).click();
  await page.locator('#note').fill('사용자 설명');
  await page.getByRole('button', { name: '링크 등록', exact: true }).click();
  await expect(page).toHaveURL(`/category/${fixtureId('ai')}`);
  await page
    .getByRole('button', { name: 'WO003 저장 테스트 상세 보기', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'WO003 저장 테스트' }),
  ).toBeVisible();
  await expect(page).toHaveURL(`/category/${fixtureId('ai')}`);
  const created = fixture.users
    .get(testUser.id)
    ?.links.find((link) => link.title === 'WO003 저장 테스트');
  if (!created) throw new Error('Missing saved link');
  await page.goto(`/links/${created.id}`);
  await page.reload();
  await expect(page.getByText('사용자 설명', { exact: true })).toBeVisible();
  await editLinkInfo(page);
  await page.locator('#edit-title').fill('WO003 수정됨');
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'WO003 수정됨' }),
  ).toBeVisible();
  await page.goto('/links');
  await expect(
    page.getByRole('link', { name: 'WO003 수정됨 열기' }),
  ).toBeVisible();
  await page.goto('/categories');
  await categoryMenu(page, 'AI', '삭제');
  await page
    .getByRole('button', { name: '카테고리 삭제', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'AI 관리', exact: true }),
  ).toHaveCount(0);
  await page.goto('/links');
  await selectLinkFilter(page, 'uncategorized');
  await expect(
    page.getByRole('link', { name: 'WO003 수정됨 열기' }),
  ).toBeVisible();
  const writes = fixture.requests.filter(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/links',
  );
  expect(writes).toHaveLength(1);
  expect(writes[0]?.postDataJSON()).toMatchObject({
    url: 'https://example.org/wo003',
    customDescription: '사용자 설명',
    categoryId: fixtureId('ai'),
  });
  expect(writes[0]?.postDataJSON()).not.toHaveProperty('note');
});

test('pagination uses cursor and resets on filter/sort; deduplicates items', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  const state = initialProduct();
  const seed = state.links[0];
  if (!seed) throw new Error('Missing fixture');
  state.links = Array.from({ length: 45 }, (_, i) => ({
    ...seed,
    id: fixtureId('page-' + i),
    title: `Page ${i}`,
    isFavorite: i % 2 === 0,
  }));
  fixture.users.set(testUser.id, state);
  await page.goto('/links');
  await expect(page.getByTestId('link-item')).toHaveCount(20);
  await page.getByRole('button', { name: '더 보기', exact: true }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(40);
  await page.getByRole('button', { name: '더 보기', exact: true }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(45);
  await expect(
    page.getByRole('button', { name: '더 보기', exact: true }),
  ).toHaveCount(0);
  await selectLinkFilter(page, 'favorites');
  await expect(page.getByTestId('link-item')).toHaveCount(20);
  await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
  await expect
    .poll(
      () =>
        fixture.requests.filter((r) => r.url().includes('sort=frequent'))
          .length,
    )
    .toBeGreaterThan(0);
  const latest = fixture.requests
    .filter((r) => r.url().includes('sort=frequent'))
    .at(-1);
  expect(latest?.url()).toContain('favorite=true');
  expect(latest?.url()).not.toContain('cursor=');
});

test('explicit new-tab open records once, keeps saved href, isolates opener and suppresses referrer', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  const id = fixtureId('chatgpt');
  const savedUrl = initialProduct().links.find((link) => link.id === id)?.url;
  if (!savedUrl) throw new Error('Missing saved URL');
  let referrer: string | undefined;
  await context.route(savedUrl, async (route) => {
    referrer = route.request().headers().referer;
    await route.fulfill({ contentType: 'text/html', body: '<h1>Opened</h1>' });
  });
  let opens = 0;
  await page.route(`${api}/links/${id}/open`, async (route) => {
    opens++;
    expect(route.request().postData()).toBeNull();
    const state = fixture.users.get(testUser.id);
    const row = state?.links.find((l) => l.id === id);
    if (row) {
      row.clickCount++;
      row.lastOpenedAt = new Date().toISOString();
      state?.events.set(id, [
        ...(state.events.get(id) ?? []),
        row.lastOpenedAt,
      ]);
    }
    await route.fulfill({
      headers: cors,
      json: {
        url: 'https://example.org/open-result',
        openedAt: new Date().toISOString(),
      },
    });
  });
  await page.goto(`/links/${id}`);
  const usage = page.getByRole('region', { name: '사용 빈도' });
  await expect(usage.getByText(/회 열었어요$/)).toBeVisible();
  const recentBefore = Number(
    (await usage.getByText(/회 열었어요$/).innerText()).replace(/[^\d]/g, ''),
  );
  const popupPromise = context.waitForEvent('page');
  await page.getByRole('link', { name: '새 탭에서 열기', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(savedUrl);
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  expect(referrer).toBeUndefined();
  expect(opens).toBe(1);
  expect(
    fixture.users.get(testUser.id)?.links.find((link) => link.id === id)
      ?.clickCount,
  ).toBe(2);
  await expect(
    usage.getByText(`${recentBefore + 1}회 열었어요`, { exact: true }),
  ).toBeVisible();
  await popup.close();
});

for (const failure of ['server', 'unsafe'] as const)
  test(`open ${failure} preserves explicit safe tab and reports record failure`, async ({
    page,
    context,
  }) => {
    await page.route(`${api}/links/*/open`, (route) =>
      route.fulfill({
        headers: cors,
        status: failure === 'server' ? 503 : 200,
        json: {
          url: 'javascript:alert(1)',
          openedAt: new Date().toISOString(),
        },
      }),
    );
    await page.goto(`/links/${fixtureId('chatgpt')}`);
    const popupPromise = context.waitForEvent('page');
    await page
      .getByRole('link', { name: '새 탭에서 열기', exact: true })
      .click();
    const popup = await popupPromise;
    const savedUrl = initialProduct().links.find(
      (link) => link.id === fixtureId('chatgpt'),
    )?.url;
    await expect(popup).toHaveURL(savedUrl ?? 'missing-fixture');
    expect(popup.isClosed()).toBe(false);
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await popup.close();
  });

test('409 and failed deletion preserve form and data; malformed list is not empty success', async ({
  page,
}) => {
  await page.goto('/links/new');
  await page.locator('#link-url').fill('https://chatgpt.com/');
  await page.getByRole('button', { name: '링크 등록', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: '링크 등록', exact: true })
      .getByRole('alert'),
  ).toContainText('이미 저장한');
  await expect(page.locator('#link-url')).toHaveValue('https://chatgpt.com/');
  await page.goto(`/links/${fixtureId('chatgpt')}`);
  await page.route(`${api}/links/${fixtureId('chatgpt')}`, async (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({ headers: cors, status: 503, json: {} })
      : route.fallback(),
  );
  await requestLinkDeletion(page);
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '링크 삭제', exact: true })
    .click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(`/links/${fixtureId('chatgpt')}`);
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '취소', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'ChatGPT', exact: true }),
  ).toBeVisible();
  await page.route(`${api}/links?**`, (route) =>
    route.fulfill({ headers: cors, json: { items: [{}], nextCursor: null } }),
  );
  await page.goto('/links');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('응답');
  await expect(page.getByText('아직 링크가 없어요')).toHaveCount(0);
});
