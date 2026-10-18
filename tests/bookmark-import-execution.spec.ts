import { openBookmarkImport } from './link-filter-helper';
import { expectLayoutWidth } from './layout-assertions';
import { test, expect, authenticate, testUser } from './auth-fixture';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import { bookmarkHtml } from './bookmark-browser-helper';
import type { Page, Route } from '@playwright/test';
import { installOrganizationApi } from './organization-fixture';

test('session loss during import clears A, and B starts with no retained file or execution', async ({
  page,
  context,
}) => {
  let calls = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route(pattern, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calls++;
    await gate;
    await route
      .fulfill({ status: 201, headers: cors, json: await created(route) })
      .catch(() => {});
  });
  await prepare(page, 5);
  await start(page);
  await expect.poll(() => calls).toBe(2);
  page.on('dialog', (dialog) => dialog.accept());
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/login/);
  await authenticate(context, false, 'alternate');
  await page.goto('/links/import');
  release();
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeEnabled();
  await expect(result(page)).toHaveCount(0);
  await expect(page.getByText('선택한 파일:', { exact: false })).toHaveCount(0);
  expect(calls).toBe(2);
});

const pattern = /^http:\/\/127\.0\.0\.1:54329\/links(?:\?|$)/;
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const base = initialProduct().links[0]!;
async function prepare(page: Page, count = 1) {
  await page.goto('/links/import');
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeEnabled();
  await page.getByLabel('HTML 파일 선택', { exact: true }).setInputFiles({
    name: 'bookmarks.html',
    mimeType: 'text/html',
    buffer: Buffer.from(bookmarkHtml(count)),
  });
  await expect(
    page.getByRole('button', { name: '선택한 링크 가져오기', exact: true }),
  ).toBeEnabled();
}
async function start(page: Page) {
  await page
    .getByRole('button', { name: '선택한 링크 가져오기', exact: true })
    .click();
}
async function finished(page: Page) {
  await expect(
    page.getByRole('heading', { name: '가져오기 처리 결과', exact: true }),
  ).toBeVisible();
}
function result(page: Page) {
  return page.getByRole('region', { name: '가져오기 실행 결과' });
}
async function metric(page: Page, name: string, count: number) {
  await expect(
    result(page)
      .locator('dl > div')
      .filter({
        has: page.locator('dt').filter({ hasText: new RegExp(`^${name}$`) }),
      }),
  ).toContainText(`${count}개`);
}
async function created(route: Route) {
  const input: unknown = route.request().postDataJSON();
  if (
    !input ||
    typeof input !== 'object' ||
    !('url' in input) ||
    typeof input.url !== 'string'
  )
    throw new Error('Invalid DTO');
  return {
    ...base,
    id: fixtureId(input.url),
    url: input.url,
    title: '등록 결과',
    categoryId: 'categoryId' in input ? input.categoryId : null,
  };
}

test('one explicit create uses exact DTO and 201, no mount/focus/reentry writes', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  await prepare(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(fixture.requests.filter((r) => r.method() === 'POST')).toHaveLength(0);
  const category = initialProduct().categories[0]!;
  await page.getByLabel('분류 방식', { exact: true }).selectOption('single');
  await page
    .getByLabel('카테고리 선택', { exact: true })
    .selectOption(category.id);
  await start(page);
  await finished(page);
  await metric(page, '등록 성공', 1);
  const requests = fixture.requests.filter((r) => r.method() === 'POST');
  expect(requests).toHaveLength(1);
  expect(requests[0]?.postDataJSON()).toEqual({
    url: 'https://import.example.test/0',
    customTitle: '링크 0',
    categoryId: category.id,
  });
  expect(requests[0]?.url()).toBe('http://127.0.0.1:54329/links');
  await page.reload();
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeVisible();
  expect(fixture.requests.filter((r) => r.method() === 'POST')).toHaveLength(1);
});

test('50 creates, max two in flight, double click lock, no per-success list GET, frozen controls', async ({
  page,
  context,
}) => {
  let pending = 0;
  let max = 0;
  let calls = 0;
  let gets = 0;
  const urls: string[] = [];
  await context.route(pattern, async (route) => {
    if (route.request().method() !== 'POST') {
      gets++;
      return route.fallback();
    }
    calls++;
    max = Math.max(max, ++pending);
    urls.push(JSON.stringify(route.request().postDataJSON()));
    await new Promise((resolve) => setTimeout(resolve, 30));
    pending--;
    await route.fulfill({
      status: 201,
      headers: cors,
      json: await created(route),
    });
  });
  await prepare(page, 50);
  const initialGets = gets;
  await page
    .getByRole('button', { name: '선택한 링크 가져오기', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('카테고리 선택', { exact: true })).toHaveCount(
    0,
  );
  await finished(page);
  await metric(page, '등록 성공', 50);
  expect(calls).toBe(50);
  expect(new Set(urls).size).toBe(50);
  expect(max).toBe(2);
  expect(gets).toBe(initialGets);
  await expect(result(page).getByRole('listitem')).toHaveCount(25);
});

for (const failure of [
  '409',
  '400',
  '404',
  '401',
  '403',
  '500',
  '502',
  '503',
  '429',
  'network',
  'timeout',
  'invalid',
  '200',
] as const) {
  test(`execution handles ${failure} without automatic POST retry`, async ({
    page,
    context,
  }) => {
    if (failure === 'timeout')
      await page.addInitScript(() => {
        const original = AbortSignal.timeout.bind(AbortSignal);
        AbortSignal.timeout = (ms: number) =>
          original(ms === 10000 ? 100 : ms === 15000 ? 200 : ms);
      });
    let calls = 0;
    await context.route(pattern, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      calls++;
      if (failure === 'network') return route.abort();
      if (failure === 'timeout') {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.abort().catch(() => {});
        return;
      }
      await route.fulfill({
        status: failure === 'invalid' ? 201 : Number(failure),
        headers: cors,
        json: failure === '200' ? await created(route) : {},
      });
    });
    const continuing = failure === '400' || failure === '409';
    await prepare(page, 5);
    await start(page);
    await finished(page);
    const expected = [
      '500',
      '502',
      '503',
      '429',
      'network',
      'timeout',
      'invalid',
      '200',
    ].includes(failure)
      ? '저장 여부 확인 불가'
      : failure === '409'
        ? '서버 중복'
        : '실패';
    await metric(page, expected, calls);
    if (continuing) expect(calls).toBe(5);
    else expect(calls).toBeLessThanOrEqual(2);
    await metric(page, '미시도', 5 - calls);
    const finishedCalls = calls;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(100);
    expect(calls).toBe(finishedCalls);
  });
}

test('partial commit with lost response reconciles unknown, excludes saved and resets next-run success count', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  let calls = 0;
  let releaseLoss: () => void = () => {};
  const thirdDispatched = new Promise<void>((resolve) => {
    releaseLoss = resolve;
  });
  await context.route(pattern, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calls++;
    if (calls === 1) return route.fallback();
    if (calls === 2) {
      const state = fixture.users.get(testUser.id)!;
      const value = await created(route);
      state.links.push({ ...base, ...value, categoryId: null });
      // Ensure the successful worker dispatched the third item before losing
      // the other response. C stops all NEW dispatch after uncertainty.
      await thirdDispatched;
      return route.abort();
    }
    if (calls === 3) {
      releaseLoss();
      return route.fulfill({ status: 400, headers: cors, json: {} });
    }
    return route.fallback();
  });
  await prepare(page, 3);
  await start(page);
  await finished(page);
  await metric(page, '등록 성공', 1);
  await metric(page, '저장 여부 확인 불가', 1);
  await metric(page, '실패', 1);
  await page
    .getByRole('button', { name: '저장 여부 다시 확인', exact: true })
    .click();
  await expect(
    page.getByText(
      '저장됨 확인 — 이번 요청으로 등록됐는지는 확정할 수 없어요.',
    ),
  ).toBeVisible();
  await metric(page, '등록 성공', 1);
  const boxes = page
    .getByRole('list', { name: '북마크 항목' })
    .getByRole('checkbox');
  await expect(boxes.nth(0)).toBeDisabled();
  await expect(boxes.nth(1)).toBeDisabled();
  await expect(boxes.nth(2)).not.toBeChecked();
  await expect(
    page.getByRole('button', { name: '선택한 링크 가져오기', exact: true }),
  ).toBeDisabled();
  await boxes.nth(2).check();
  await start(page);
  await finished(page);
  await metric(page, '등록 성공', 1);
  expect(calls).toBe(4);
});

test('user stop drains two pending requests and preserves remaining not_attempted without resume', async ({
  page,
  context,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await context.route(pattern, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calls++;
    await gate;
    await route.fulfill({
      status: 201,
      headers: cors,
      json: await created(route),
    });
  });
  await prepare(page, 5);
  await start(page);
  await expect.poll(() => calls).toBe(2);
  await page.getByRole('button', { name: '새 요청 중단', exact: true }).click();
  release();
  await finished(page);
  await metric(page, '등록 성공', 2);
  await metric(page, '미시도', 3);
  expect(calls).toBe(2);
});

test('account B never receives A delayed execution results or additional dispatches', async ({
  page,
  context,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await context.route(pattern, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calls++;
    await gate;
    await route
      .fulfill({ status: 201, headers: cors, json: await created(route) })
      .catch(() => {});
  });
  await prepare(page, 5);
  await start(page);
  await expect.poll(() => calls).toBe(2);
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeEnabled();
  release();
  await page.waitForTimeout(100);
  await expect(result(page)).toHaveCount(0);
  expect(calls).toBe(2);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain('import.example.test');
});

for (const [guardWidth, destination] of [
  [390, '홈'],
  [1440, '홈'],
  [1440, 'LINK BISEO 홈으로 이동'],
] as const)
  test(`SPA guard cancels or allows exit at ${guardWidth}px via ${destination}, unmount stops dispatch; Back is not history rollback`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: guardWidth, height: 900 });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    await context.route(pattern, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      calls++;
      await gate;
      await route
        .fulfill({ status: 201, headers: cors, json: await created(route) })
        .catch(() => {});
    });
    await prepare(page, 5);
    await start(page);
    await expect.poll(() => calls).toBe(2);
    page.once('dialog', (dialog) => dialog.dismiss());
    await page
      .getByRole('navigation', { name: '주요 메뉴' })
      .getByRole('link', { name: destination, exact: true })
      .click();
    await expect(page).toHaveURL('/links/import');
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('navigation', { name: '주요 메뉴' })
      .getByRole('link', { name: destination, exact: true })
      .click();
    await expect(page).toHaveURL('/');
    release();
    await page.waitForTimeout(100);
    expect(calls).toBe(2);
    await page.goBack();
    await expect(page).toHaveURL('/links/import');
    await expect(result(page)).toHaveCount(0);
  });

test('reload requests beforeunload warning and clears execution with no resume', async ({
  page,
  context,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await context.route(pattern, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calls++;
    await gate;
    await route.abort().catch(() => {});
  });
  await prepare(page, 4);
  await start(page);
  await expect.poll(() => calls).toBe(2);
  let warned = false;
  page.once('dialog', async (dialog) => {
    warned = dialog.type() === 'beforeunload';
    await dialog.accept();
  });
  await page.reload();
  release();
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeEnabled();
  expect(warned).toBe(true);
  expect(calls).toBe(2);
});

for (const width of [320, 390, 512, 1440])
  test(`execution result layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, 2);
    await start(page);
    await finished(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expectLayoutWidth(page);
    await page.screenshot({
      path: `artifacts/wo-011-b/result-${width}.png`,
      fullPage: true,
    });
  });

for (const uncertain of [false, true])
  test(`import ${uncertain ? 'unknown' : 'success'} marks report stale without report POST and refreshes saved queries`, async ({
    page,
    context,
  }) => {
    const api = await installOrganizationApi(context);
    await page.goto('/assistant/organization?action=run');
    await expect(page.locator('time')).toBeVisible();
    const stamp = await page.locator('time').getAttribute('datetime');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '내 링크', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: '내 링크' })).toBeVisible();
    await openBookmarkImport(page);
    if (uncertain)
      await context.route(pattern, (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 500, headers: cors, json: {} })
          : route.fallback(),
      );
    await expect(
      page.getByLabel('HTML 파일 선택', { exact: true }),
    ).toBeEnabled();
    await page.getByLabel('HTML 파일 선택', { exact: true }).setInputFiles({
      name: 'bookmarks.html',
      mimeType: 'text/html',
      buffer: Buffer.from(bookmarkHtml(1)),
    });
    await expect(
      page.getByRole('button', { name: '선택한 링크 가져오기', exact: true }),
    ).toBeEnabled();
    await start(page);
    await finished(page);
    await metric(page, uncertain ? '저장 여부 확인 불가' : '등록 성공', 1);
    await page.goBack();
    await expect(page).toHaveURL('/links');
    if (!uncertain)
      await expect(page.getByText('링크 0', { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL('/assistant/organization');
    await expect(page.locator('time')).toHaveAttribute('datetime', stamp!);
    await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toBeVisible();
    expect(api.requests).toHaveLength(1);
  });

test('failed reconciliation never enables retry, while category deletion stops and requires reselection', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  let calls = 0;
  let failRead = false;
  await context.route(pattern, async (route) => {
    if (route.request().method() !== 'POST')
      return failRead
        ? route.fulfill({ status: 500, headers: cors, json: {} })
        : route.fallback();
    calls++;
    fixture.users.get(testUser.id)!.categories = [];
    return route.fulfill({ status: 404, headers: cors, json: {} });
  });
  await prepare(page, 4);
  await page.getByLabel('분류 방식', { exact: true }).selectOption('single');
  await page
    .getByLabel('카테고리 선택', { exact: true })
    .selectOption(initialProduct().categories[0]!.id);
  await start(page);
  await finished(page);
  expect(calls).toBeLessThanOrEqual(2);
  failRead = true;
  await page
    .getByRole('button', { name: '저장 여부 다시 확인', exact: true })
    .click();
  await expect(
    page.getByText('전체 조회가 끝나지 않아 재시도할 수 없어요.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '선택한 링크 가져오기', exact: true }),
  ).toHaveCount(0);
  failRead = false;
  await page
    .getByRole('button', { name: '저장 여부 다시 확인', exact: true })
    .click();
  await expect(
    page.getByText('선택한 카테고리가 없어졌어요. 다시 선택하세요.'),
  ).toBeVisible();
  await page
    .getByRole('list', { name: '북마크 항목' })
    .getByRole('checkbox')
    .first()
    .check();
  await expect(
    page.getByRole('button', { name: '선택한 링크 가져오기', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('카테고리 선택', { exact: true }).selectOption('');
  await expect(
    page.getByRole('button', { name: '선택한 링크 가져오기', exact: true }),
  ).toBeEnabled();
});

test('Browser Back during execution unmounts without fake history or automatic resumption', async ({
  page,
  context,
}) => {
  let calls = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route(pattern, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calls++;
    await gate;
    await route.abort().catch(() => {});
  });
  await page.goto('/links');
  await openBookmarkImport(page);
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeEnabled();
  await page.getByLabel('HTML 파일 선택', { exact: true }).setInputFiles({
    name: 'b.html',
    mimeType: 'text/html',
    buffer: Buffer.from(bookmarkHtml(5)),
  });
  await expect(
    page.getByRole('button', { name: '선택한 링크 가져오기', exact: true }),
  ).toBeEnabled();
  await start(page);
  await expect.poll(() => calls).toBe(2);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goBack();
  await expect(page).toHaveURL('/links');
  release();
  await page.goForward();
  await expect(page).toHaveURL('/links/import');
  await expect(result(page)).toHaveCount(0);
  expect(calls).toBe(2);
});
