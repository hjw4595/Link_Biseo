import { selectLinkFilter } from './link-filter-helper';
import { requestLinkDeletion } from './link-actions-helper';
import {
  expectLayoutWidth,
  expectClearOfNavigation,
} from './layout-assertions';
import { test, expect, testUser, authenticate } from './auth-fixture';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import type { BrowserContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { installOrganizationApi } from './organization-fixture';

// Full Chromium exercises browser-level tab commands as well as page events.
test.use({ channel: 'chromium' });

const api = 'http://127.0.0.1:54329';
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const destination = 'https://outside.example.test/open?keep=1#part';
const id = fixtureId('chatgpt');
const openPath = `${api}/links/${id}/open`;
const valid = { url: destination, openedAt: '2026-10-25T00:00:00.000Z' };
async function seed(context: BrowserContext) {
  const fixture = await installProductApi(context);
  const state = initialProduct();
  const link = state.links.find((item) => item.id === id);
  if (!link) throw new Error('Missing link');
  link.url = destination;
  fixture.users.set(testUser.id, state);
  return { ...fixture, state, link };
}

for (const entry of [
  '/',
  `/category/${fixtureId('ai')}`,
  '/links',
  `/links/${id}`,
])
  test(`normal click waits for one record then navigates current tab from ${entry}`, async ({
    page,
    context,
  }) => {
    const fixture = await seed(context);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    await page.route(openPath, async (route) => {
      calls++;
      expect(route.request().postData()).toBeNull();
      expect(route.request().headers().authorization).toMatch(/^Bearer /);
      await gate;
      await route.fulfill({ headers: cors, json: valid });
    });
    let externalHeaders: Record<string, string> = {};
    await context.route('https://outside.example.test/**', async (route) => {
      externalHeaders = route.request().headers();
      await route.fulfill({
        contentType: 'text/html',
        body: '<h1>Mock destination</h1>',
      });
    });
    await page.goto(entry);
    const anchor = page.getByRole('link', {
      name: entry.startsWith('/links/') ? '링크 열기' : 'ChatGPT 열기',
      exact: true,
    });
    await expect(anchor).not.toHaveAttribute('target', '_blank');
    await page.evaluate(() => {
      window.open = () => {
        throw new Error('Unexpected window.open');
      };
    });
    await anchor.click();
    await expect.poll(() => calls).toBe(1);
    await expect(page).toHaveURL(entry);
    await expect(anchor).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('button', { name: '열기 취소' })).toBeVisible();
    expect(context.pages()).toHaveLength(1);
    release();
    await expect(page).toHaveURL(destination);
    expect(calls).toBe(1);
    expect(externalHeaders.authorization).toBeUndefined();
    expect(externalHeaders.referer).toBeUndefined();
    expect(context.pages()).toHaveLength(1);
    expect(fixture.link.url).toBe(destination);
    await page.goBack();
    await expect(page).toHaveURL(entry);
    await expect(anchor).toBeVisible();
  });

test('Enter uses current tab and response URL cannot substitute the saved destination', async ({
  page,
  context,
}) => {
  await seed(context);
  await page.route(openPath, (route) =>
    route.fulfill({
      headers: cors,
      json: { ...valid, url: 'https://substitute.example.test/' },
    }),
  );
  await page.goto('/links');
  const anchor = page.getByRole('link', { name: 'ChatGPT 열기', exact: true });
  await anchor.focus();
  await expect(anchor).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(destination);
  expect(context.pages()).toHaveLength(1);
});

test.describe('native browser input', () => {
  for (const kind of ['control', 'middle', 'shift', 'detail-menu'] as const)
    test(`${kind} opens native tab before delayed POST, with no opener/referrer`, async ({
      page,
      context,
    }) => {
      const fixture = await seed(context);
      const nativeDestination = `${api}/external?keep=1#part`;
      fixture.link.url = nativeDestination;
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let calls = 0;
      await page.route(openPath, async (route) => {
        calls++;
        await gate;
        await route.fulfill({ headers: cors, json: valid });
      });
      const entry = kind === 'detail-menu' ? `/links/${id}` : '/links';
      await page.goto(entry);
      if (kind === 'control' || kind === 'middle') {
        await page.getByRole('searchbox').fill('ChatGPT');
        await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
        await selectLinkFilter(page, 'favorites');
      }

      const preservedUrl = page.url();
      const anchor = page.getByRole('link', {
        name: kind.endsWith('menu') ? '새 탭에서 열기' : 'ChatGPT 열기',
        exact: true,
      });
      // Complete dev-overlay handling before applying native mouse modifiers.
      await anchor.focus();
      await page.bringToFront();
      const popup = context.waitForEvent('page');
      await anchor.click(
        kind === 'control'
          ? { modifiers: ['Control'] }
          : kind === 'middle'
            ? { button: 'middle' }
            : kind === 'shift'
              ? { modifiers: ['Shift'] }
              : {},
      );
      const opened = await popup;
      await expect(opened).toHaveURL(nativeDestination);
      await expect(page).toHaveURL(preservedUrl);
      if (kind === 'control' || kind === 'middle') {
        await expect(page.getByRole('searchbox')).toHaveValue('ChatGPT');
        await expect(page.getByLabel('정렬', { exact: true })).toHaveValue(
          'frequent',
        );
        await expect(
          page.getByRole('button', { name: '즐겨찾기', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
      }
      expect(await opened.evaluate(() => window.opener === null)).toBe(true);
      await expect(opened.locator('#authorization')).toHaveText('false');
      await expect(opened.locator('#referrer')).toHaveText('false');
      await expect.poll(() => calls).toBe(1);
      expect(
        fixture.requests.filter((r) => r.url().endsWith('/open')),
      ).toHaveLength(0); // Delayed override has not committed.
      release();
      await opened.close();
    });
});

for (const failure of [
  '401',
  '403',
  '404',
  '500',
  'network',
  'timeout',
  'malformed',
  'unsafe',
  'lost-response',
] as const)
  test(`${failure}: no automatic retry, visible feedback and record-free continuation`, async ({
    page,
    context,
  }) => {
    const fixture = await seed(context);
    let calls = 0;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(openPath, async (route) => {
      calls++;
      if (failure === 'timeout') {
        await gate;
        return route.fulfill({ headers: cors, json: valid }).catch(() => {});
      }
      if (failure === 'lost-response') {
        fixture.link.clickCount++;
        return route.abort('failed');
      }
      if (failure === 'network') return route.abort('failed');
      if (failure === 'malformed')
        return route.fulfill({
          headers: cors,
          contentType: 'application/json',
          body: '{',
        });
      if (failure === 'unsafe')
        return route.fulfill({
          headers: cors,
          json: { ...valid, url: 'javascript:alert(1)' },
        });
      return route.fulfill({
        headers: cors,
        status: Number(failure),
        json: {},
      });
    });
    await page.goto('/links');
    await page.getByRole('link', { name: 'ChatGPT 열기', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: '사용 기록' }),
    ).toBeVisible();
    await expect(page).toHaveURL('/links');
    expect(calls).toBe(failure === '401' ? 2 : 1);
    const beforeContinue = calls;
    await page
      .getByRole('link', { name: '기록 없이 열기', exact: true })
      .click();
    await expect(page).toHaveURL(destination);
    expect(calls).toBe(beforeContinue);
    if (failure === 'lost-response') expect(fixture.link.clickCount).toBe(2);
    release();
  });

test('rejected 401 refresh succeeds once before current navigation', async ({
  page,
  context,
}) => {
  await seed(context);
  let calls = 0;
  let refreshes = 0;
  context.on('request', (request) => {
    if (request.url().includes('grant_type=refresh_token')) refreshes++;
  });
  await page.route(openPath, (route) =>
    route.fulfill({
      headers: cors,
      status: ++calls === 1 ? 401 : 200,
      json: calls === 1 ? {} : valid,
    }),
  );
  await page.goto('/links');
  await page.getByRole('link', { name: 'ChatGPT 열기', exact: true }).click();
  await expect(page).toHaveURL(destination);
  expect(calls).toBe(2);
  expect(refreshes).toBe(1);
});

test('cancel prevents late navigation; two independent activations retain two records', async ({
  page,
  context,
}) => {
  await seed(context);
  let calls = 0;
  const releases: Array<() => void> = [];
  await page.route(openPath, async (route) => {
    calls++;
    await new Promise<void>((resolve) => releases.push(resolve));
    await route.fulfill({ headers: cors, json: valid }).catch(() => {});
  });
  await page.goto('/links');
  const anchor = page.getByRole('link', { name: 'ChatGPT 열기', exact: true });
  await anchor.click();
  await expect.poll(() => calls).toBe(1);
  await page.getByRole('button', { name: '열기 취소' }).click();
  releases[0]?.();
  await expect(page).toHaveURL('/links');
  await anchor.click();
  await anchor.click();
  await expect.poll(() => calls).toBe(3);
  releases[1]?.();
  // The superseded request must not navigate while the latest remains pending.
  await expect(
    page.getByRole('status').filter({ hasText: '사용 기록' }),
  ).toBeVisible();
  await expect(page).toHaveURL('/links');
  releases[2]?.();
  await expect(page).toHaveURL(destination);
  expect(calls).toBe(3);
});

test('navigation away and account change suppress pending external navigation', async ({
  page,
  context,
}) => {
  await seed(context);
  const releases: Array<() => void> = [];
  let calls = 0;
  await page.route(openPath, async (route) => {
    calls++;
    await new Promise<void>((resolve) => releases.push(resolve));
    await route.fulfill({ headers: cors, json: valid }).catch(() => {});
  });
  await page.goto('/links');
  await page.getByRole('link', { name: 'ChatGPT 열기', exact: true }).click();
  await expect.poll(() => calls).toBe(1);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '홈', exact: true })
    .click();
  releases[0]?.();
  await expect(page).toHaveURL('/');
  await page.getByRole('link', { name: 'ChatGPT 열기', exact: true }).click();
  await expect.poll(() => calls).toBe(2);
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '설정', exact: true })
    .click();
  await expect(page.getByText('second@example.test')).toBeVisible();
  releases[1]?.();
  await expect(page).toHaveURL('/settings');
  await expect(page.getByRole('link', { name: '기록 없이 열기' })).toHaveCount(
    0,
  );
});

for (const unsafe of [
  'javascript:alert(1)',
  'data:text/plain,hi',
  'file:///C:/test',
  'broken',
  'https://user:password@example.test/',
])
  test(`unsafe saved URL is never opened or recorded: ${unsafe.split(':')[0]}`, async ({
    page,
    context,
  }) => {
    const fixture = await seed(context);
    fixture.link.url = unsafe;
    await page.goto('/links');
    await page
      .getByRole('button', { name: 'ChatGPT 열기', exact: true })
      .click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      '안전하게',
    );
    expect(
      fixture.requests.filter((r) => r.url().endsWith('/open')),
    ).toHaveLength(0);
    expect(context.pages()).toHaveLength(1);
    await expect(page).toHaveURL('/links');
    await page.goto(`/links/${id}`);
    await page.getByRole('button', { name: '링크 열기', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      '안전하게',
    );
    await expect(
      page.getByRole('button', { name: '새 탭에서 열기', exact: true }),
    ).toBeVisible();
    expect(
      fixture.requests.filter((r) => r.url().endsWith('/open')),
    ).toHaveLength(0);
  });

test('contextmenu and favorite/detail management never record an Open', async ({
  page,
  context,
}) => {
  const fixture = await seed(context);
  await page.goto('/links');
  const anchor = page.getByRole('link', { name: 'ChatGPT 열기', exact: true });
  await anchor.click({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('/links');
  await page
    .getByRole('button', { name: 'ChatGPT 즐겨찾기', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'ChatGPT 즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await expect(page).toHaveURL('/links');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    fixture.requests.filter((r) => r.url().endsWith('/open')),
  ).toHaveLength(0);
  expect(context.pages()).toHaveLength(1);
});

test('detail deletion supports cancel/failure/pending lock and returns to a valid list', async ({
  page,
  context,
}) => {
  const fixture = await seed(context);
  let fail = true;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let deletes = 0;
  await page.route(`${api}/links/${id}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    deletes++;
    if (fail) return route.fulfill({ headers: cors, status: 500, json: {} });
    await gate;
    fixture.state.links = fixture.state.links.filter((link) => link.id !== id);
    return route.fulfill({ headers: cors, status: 204 });
  });
  await page.goto(`/links/${id}`);
  const trigger = page.getByRole('button', { name: '삭제', exact: true });
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await requestLinkDeletion(page);
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toHaveCount(1);
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(trigger).toBeFocused();
  await requestLinkDeletion(page);
  await dialog.getByRole('button', { name: '링크 삭제', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  fail = false;
  await dialog.getByRole('button', { name: '링크 삭제', exact: true }).click();
  await expect.poll(() => deletes).toBe(2);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(1);
  await expect(
    dialog.getByRole('button', { name: '링크 삭제', exact: true }),
  ).toBeDisabled();
  release();
  await expect(page).toHaveURL('/links');
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'ChatGPT 상세 보기', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId('link-item')).toHaveCount(7);
  expect(deletes).toBe(2);
});

test('two native activations open two tabs and commit two records', async ({
  page,
  context,
}) => {
  const fixture = await seed(context);
  fixture.link.url = `${api}/external`;
  await page.goto(`/links/${id}`);
  const anchor = page.getByRole('link', {
    name: '새 탭에서 열기',
    exact: true,
  });
  for (let i = 0; i < 2; i++) {
    const popup = context.waitForEvent('page');
    await anchor.click();
    await expect(await popup).toHaveURL(`${api}/external`);
  }
  await expect.poll(() => fixture.link.clickCount).toBe(3);
  expect(
    fixture.requests.filter((request) => request.url().endsWith('/open')),
  ).toHaveLength(2);
  expect(context.pages()).toHaveLength(3);
});

for (const failure of ['server', 'unsafe'] as const)
  test(`failed ${failure} Open changes neither stats nor cached report`, async ({
    page,
    context,
  }) => {
    const fixture = await installOrganizationApi(context);
    await page.goto('/assistant/organization?action=run');
    await expect(
      page.getByRole('button', { name: '다시 분석', exact: true }),
    ).toBeEnabled();
    const region = page.getByRole('region', { name: '카테고리가 없는 링크' });
    await region.getByRole('button').click();
    await region.getByRole('link').first().click();
    await expect(page).toHaveURL(`/links/${fixtureId('react')}`);
    const usage = page.getByRole('region', { name: '사용 빈도' });
    await expect(usage.getByText(/회 열었어요$/)).toBeVisible();
    const before = await usage.getByText(/회 열었어요$/).innerText();
    const reads = fixture.productRequests.filter(
      (r) => r.method() === 'GET' && r.url().includes('/stats'),
    ).length;
    let calls = 0;
    await page.route(`${api}/links/*/open`, (route) => {
      calls++;
      return route.fulfill({
        headers: cors,
        status: failure === 'server' ? 500 : 200,
        json:
          failure === 'server'
            ? {}
            : { ...valid, url: 'data:text/html,unsafe' },
      });
    });
    await page.getByRole('link', { name: '링크 열기', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: '사용 기록' }),
    ).toBeVisible();
    await expect(usage.getByText(/회 열었어요$/)).toHaveText(before);
    expect(calls).toBe(1);
    expect(
      fixture.productRequests.filter(
        (r) => r.method() === 'GET' && r.url().includes('/stats'),
      ),
    ).toHaveLength(reads);
    await page.goBack();
    await expect(
      page.getByRole('button', { name: '다시 분석', exact: true }),
    ).toBeEnabled();
    await expect(page.getByText(/링크 정보나 정리 기준이 변경/)).toHaveCount(0);
    expect(fixture.requests).toHaveLength(1);
    expect(fixture.modelRequests).toHaveLength(0);
  });

test('UI preview external links never acquire Open API hooks', async ({
  page,
  context,
}) => {
  const fixture = await seed(context);
  await page.goto('/dev/ui');
  const anchor = page.locator('a[data-external-link]').first();
  const href = await anchor.getAttribute('href');
  if (!href) throw new Error('Missing preview href');
  await anchor.click();
  await expect(page).toHaveURL(href);
  expect(
    fixture.requests.filter((request) => request.url().endsWith('/open')),
  ).toHaveLength(0);
});

test('committed Open does not wait for slow follow-up stats GET', async ({
  page,
  context,
}) => {
  const fixture = await seed(context);
  let reads = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${api}/links/${id}/stats?*`, async (route) => {
    if (++reads === 1) return route.fallback();
    await gate;
    return route.fallback().catch(() => {});
  });
  await page.goto(`/links/${id}`);
  await expect(
    page.getByRole('region', { name: '사용 빈도' }).getByText(/회 열었어요$/),
  ).toBeVisible();
  await page.getByRole('link', { name: '링크 열기', exact: true }).click();
  await expect(page).toHaveURL(destination);
  expect(fixture.link.clickCount).toBe(2);
  release();
});

test('external load failure never rolls back a committed Open or repeats its POST', async ({
  page,
  context,
}) => {
  const fixture = await seed(context);
  await context.route('https://outside.example.test/**', (route) =>
    route.abort('failed'),
  );
  await page.goto(`/links/${id}`);
  const popup = context.waitForEvent('page');
  await page.getByRole('link', { name: '새 탭에서 열기', exact: true }).click();
  const opened = await popup;
  await expect.poll(() => fixture.link.clickCount).toBe(2);
  await expect(page).toHaveURL(`/links/${id}`);
  expect(
    fixture.requests.filter((r) => r.url().endsWith('/open')),
  ).toHaveLength(1);
  expect(opened.isClosed()).toBe(false);
  await opened.close();
});

test.describe('touch activation', () => {
  test.use({ hasTouch: true });
  test('tap navigates current tab after one Open', async ({
    page,
    context,
  }) => {
    const fixture = await seed(context);
    await page.goto('/links');
    await page.getByRole('link', { name: 'ChatGPT 열기', exact: true }).tap();
    await expect(page).toHaveURL(destination);
    expect(
      fixture.requests.filter((r) => r.url().endsWith('/open')),
    ).toHaveLength(1);
    expect(context.pages()).toHaveLength(1);
  });
});

test('deleting the only link from detail returns to the persistent empty list', async ({
  page,
  context,
}) => {
  const fixture = await seed(context);
  fixture.state.links = [fixture.link];
  await page.goto('/links');
  await page.getByRole('searchbox').fill('ChatGPT');
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await requestLinkDeletion(page);
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '링크 삭제', exact: true })
    .click();
  await expect(page).toHaveURL('/links?q=ChatGPT');
  await expect(page.getByText('검색 결과가 없어요.')).toBeVisible();
  await expect(
    page.getByLabel('저장한 링크 목록', { exact: true }),
  ).toBeVisible();
});

for (const width of [320, 390, 512, 1440])
  test(`responsive link/menu/feedback and keyboard at ${width}px`, async ({
    page,
    context,
  }) => {
    const fixture = await seed(context);
    fixture.link.title = '아주 긴 링크 제목과 도메인 '.repeat(15);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(openPath, (route) =>
      route.fulfill({ headers: cors, status: 500, json: {} }),
    );
    await page.goto('/links');
    const anchor = page.getByRole('link', {
      name: `${fixture.link.title} 열기`,
      exact: true,
    });
    await anchor.focus();
    await expect(anchor).toBeFocused();
    const box = await anchor.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('link', { name: '기록 없이 열기' }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: '주요 메뉴' }),
    ).toBeVisible();
    const detail = page.getByRole('button', {
      name: `${fixture.link.title} 상세 보기`,
      exact: true,
    });
    await expect(detail).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await mkdir('artifacts/wo-010', { recursive: true });
    await page.screenshot({
      path: `artifacts/wo-010/feedback-${width}.png`,
      fullPage: true,
    });
    await detail.click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(
      page
        .getByRole('dialog')
        .getByRole('button', { name: '정보 수정', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/wo-010/detail-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(detail).toBeFocused();
    await expect(page).toHaveURL('/links');
    const last = page.getByTestId('link-item').last();
    // Keep the final link and its detail action clear of fixed navigation.
    await last.evaluate((node) => node.scrollIntoView({ block: 'center' }));
    await expectClearOfNavigation(page, last);
    await expect(
      page.getByRole('link', { name: '카테고리 관리', exact: true }),
    ).toHaveCount(0);
    const finalAction = last.getByRole('button', { name: /상세 보기$/ });
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expectClearOfNavigation(page, finalAction);
    await expectLayoutWidth(page);
  });
