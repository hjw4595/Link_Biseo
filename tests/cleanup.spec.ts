import {
  test,
  expect,
  testUser,
  authenticate,
  testSession,
} from './auth-fixture';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import { isCleanupResponse, isUserPreferences } from '../src/contracts/cleanup';
import type { BrowserContext } from '@playwright/test';
async function seed(context: BrowserContext, count = 3) {
  const api = await installProductApi(context);
  const state = initialProduct();
  const base = state.links[0]!;
  state.links = Array.from({ length: count }, (_, index) => ({
    ...base,
    id: fixtureId(`cleanup-${index}`),
    title: `정리 자료 ${index + 1}`,
    isFavorite: false,
    lastOpenedAt: null,
    clickCount: 0,
    createdAt: `2025-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  }));
  api.users.set(testUser.id, state);
  return { ...api, state };
}
test('runtime contracts reject fabricated settings and malformed cleanup', () => {
  for (const value of [7, 14, 30, null])
    expect(isUserPreferences({ cleanupThresholdDays: value })).toBe(true);
  for (const value of [0, '14', undefined, false])
    expect(isUserPreferences({ cleanupThresholdDays: value })).toBe(false);
  expect(
    isCleanupResponse({
      thresholdDays: null,
      timeZone: 'UTC',
      asOfDate: '2026-10-15',
      serverNow: '2026-10-15T00:00:00.000Z',
      totalCount: 0,
      items: [],
      nextCursor: null,
    }),
  ).toBe(true);
  expect(
    isCleanupResponse({ thresholdDays: null, totalCount: 5, items: [] }),
  ).toBe(false);
});
test('collapsed accordion, keyboard, pagination and detail do not record an open', async ({
  page,
  context,
}) => {
  const api = await seed(context, 15);
  await page.goto('/assistant/organization?preview=cleanup');
  const trigger = page.getByRole('button', { name: /정리할 링크가 15개/ });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.focus();
  await page.keyboard.press('Space');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const section = page.getByRole('region', { name: '미사용 링크 정리' });
  await expect(section.getByRole('link')).toHaveCount(10);
  await section.getByRole('button', { name: '더 불러오기' }).click();
  await expect(section.getByRole('link')).toHaveCount(15);
  await expect(section.getByRole('link').first()).toContainText('정리 자료 1');
  expect(
    await section
      .locator('[id]')
      .evaluate((node) => node.scrollHeight > node.clientHeight),
  ).toBe(true);
  await section.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/links\//);
  expect(api.requests.filter((r) => r.url().endsWith('/open'))).toHaveLength(0);
  const request = api.requests.find((r) => r.url().includes('/links/cleanup'))!;
  expect(new URL(request.url()).searchParams.get('timeZone')).toBe(
    await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  expect(new URL(request.url()).searchParams.has('thresholdDays')).toBe(false);
});
test('delete cancellation, failure retry, duplicate guard and last candidate removal', async ({
  page,
  context,
}) => {
  const api = await seed(context, 1);
  let attempts = 0;
  await context.route(`**/links/${api.state.links[0]!.id}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 500,
        headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
        json: {},
      });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return route.fallback();
  });
  await page.goto('/assistant/organization?preview=cleanup');
  await page.getByRole('button', { name: /정리할 링크가 1개/ }).click();
  await page.getByRole('button', { name: '정리 자료 1 삭제' }).click();
  const dialog = page.getByRole('alertdialog', {
    name: '이 링크를 삭제할까요?',
  });
  await expect(dialog).toContainText('삭제한 링크는 복구할 수 없습니다.');
  await dialog.getByRole('button', { name: '취소' }).click();
  expect(attempts).toBe(0);
  await page.getByRole('button', { name: '정리 자료 1 삭제' }).click();
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(api.state.links).toHaveLength(1);
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: '삭제', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('region', { name: '미사용 링크 정리' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '미사용 링크 정리 검증', exact: true }),
  ).toBeFocused();
  expect(attempts).toBe(2);
});
test('zero and disabled are hidden; settings persist, isolate accounts and reject failed saves', async ({
  page,
  context,
}) => {
  const api = await seed(context, 0);
  await page.goto('/assistant/organization?preview=cleanup');
  await expect(
    page.getByRole('heading', { name: '미사용 링크 정리 검증', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: '미사용 링크 정리' }),
  ).toHaveCount(0);
  await page.goto('/settings');
  const select = page.getByLabel('미사용 링크 추천 기간');
  await expect(select).toHaveValue('14');
  for (const value of ['7', '30', 'off']) {
    await select.selectOption(value);
    await expect(
      page.getByRole('status').filter({ hasText: '저장했어요.' }),
    ).toBeVisible();
    await expect(select).toHaveValue(value);
  }
  await page.reload();
  await expect(select).toHaveValue('off');
  const before = api.requests.filter((r) =>
    r.url().includes('/links/cleanup'),
  ).length;
  await page.goto('/assistant/organization?preview=cleanup');
  await expect(
    page.getByRole('heading', { name: '미사용 링크 정리 검증', exact: true }),
  ).toBeVisible();
  expect(
    api.requests.filter((r) => r.url().includes('/links/cleanup')).length,
  ).toBe(before);
  await page.goto('/settings');
  await context.route('**/users/me/preferences', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 500,
          headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
          json: {},
        })
      : route.fallback(),
  );
  await select.selectOption('7');
  await expect(
    page.getByRole('region', { name: '링크 관리' }).getByRole('alert'),
  ).toBeVisible();
  await expect(select).toHaveValue('off');
  await authenticate(context, false, 'alternate');
  await page.reload();
  await expect(select).toHaveValue('14');
});
test('preferences or candidate errors stay local and retry', async ({
  page,
  context,
}) => {
  await seed(context);
  let fail = true;
  await context.route('**/users/me/preferences', (route) =>
    fail
      ? route.fulfill({
          status: 500,
          headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
          json: {},
        })
      : route.fallback(),
  );
  await page.goto('/assistant/organization?preview=cleanup');
  await expect(page.getByText('정리 안내를 불러오지 못했어요.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '미사용 링크 정리 검증', exact: true }),
  ).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(
    page.getByRole('button', { name: /정리할 링크가 3개/ }),
  ).toBeVisible();
});
test('favorite and actual open exclude candidates; focus reconciles changed data', async ({
  page,
  context,
}) => {
  const api = await seed(context, 3);
  await page.goto('/assistant/organization?preview=cleanup');
  await page.getByRole('button', { name: /정리할 링크가 3개/ }).click();
  await page
    .getByRole('region', { name: '미사용 링크 정리' })
    .getByRole('link')
    .first()
    .click();
  await expect(page).toHaveURL(/\/links\/[a-f0-9-]+$/);
  await expect(page.locator('h1')).toContainText('정리 자료');
  const favoriteTitle = await page.locator('h1').innerText();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  await page
    .getByRole('button', { name: `${favoriteTitle} 즐겨찾기`, exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: `${favoriteTitle} 즐겨찾기`,
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/assistant/organization?preview=cleanup');
  await page.getByRole('button', { name: /정리할 링크가 2개/ }).click();
  await page
    .getByRole('region', { name: '미사용 링크 정리' })
    .getByRole('link')
    .first()
    .click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: '새 탭에서 열기', exact: true }).click();
  const tab = await popup;
  await expect
    .poll(() => api.state.links.filter((link) => !!link.lastOpenedAt).length)
    .toBe(1);
  await tab.close();
  await page.goto('/assistant/organization?preview=cleanup');
  await expect(
    page.getByRole('button', { name: /정리할 링크가 1개/ }),
  ).toBeVisible();
  api.state.links = [];
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await expect(
    page.getByRole('region', { name: '미사용 링크 정리' }),
  ).toHaveCount(0);
});
test('local midnight and changed IANA zone refresh keys without polling', async ({
  page,
  context,
}) => {
  const api = await seed(context);
  const session = testSession(),
    expires =
      Math.floor(
        Math.max(Date.now(), Date.parse('2026-10-17T00:00:00Z')) / 1000,
      ) + 86400;
  session.expires_at = expires;
  session.expires_in = 86400;
  session.access_token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(
      JSON.stringify({
        sub: testUser.id,
        exp: expires,
        aud: 'authenticated',
        kind: 'valid',
      }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value:
        'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ]);
  const zone = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const before =
    zone === 'Asia/Seoul' ? '2026-10-15T14:59:59Z' : '2026-10-15T23:59:59Z';
  await page.clock.setFixedTime(new Date(before));
  await page.goto('/assistant/organization?preview=cleanup');
  await expect(
    page.getByRole('button', { name: /정리할 링크가 3개/ }),
  ).toBeVisible();
  const reads = () =>
    api.requests.filter((r) => r.url().includes('/links/cleanup')).length;
  const initial = reads();
  await page.clock.setFixedTime(new Date(Date.parse(before) + 1100));
  await page.clock.fastForward(1100);
  await expect.poll(reads).toBeGreaterThan(initial);
  const midnight = reads();
  await page.clock.fastForward(60000);
  expect(reads()).toBe(midnight);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', {
    timezoneId: 'America/Los_Angeles',
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.runFor(100);
  await expect
    .poll(() =>
      api.requests.some(
        (r) =>
          new URL(r.url()).searchParams.get('timeZone') ===
          'America/Los_Angeles',
      ),
    )
    .toBe(true);
});
for (const width of [320, 375, 390, 430, 512, 1440]) {
  test(`cleanup layout and states at ${width}px`, async ({ page, context }) => {
    await seed(context, 3);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/assistant/organization?preview=cleanup');
    const trigger = page.getByRole('button', { name: /정리할 링크가 3개/ });
    await expect(trigger).toBeVisible();
    await page.screenshot({
      path: `artifacts/wo-007/${width}-collapsed.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await trigger.click();
    await page.screenshot({
      path: `artifacts/wo-007/${width}-expanded.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: '정리 자료 1 삭제' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.screenshot({
      path: `artifacts/wo-007/${width}-delete-dialog.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /정리할 링크가 2개/ }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/wo-007/${width}-after-delete.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: '정리 자료 2 삭제' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: '삭제', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: /정리할 링크가 1개/ }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/wo-007/${width}-one-candidate.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto('/settings');
    const select = page.getByLabel('미사용 링크 추천 기간');
    await expect(select).toHaveValue('14');
    for (const value of ['14', '7', '30', 'off']) {
      if (value !== '14') {
        await select.selectOption(value);
        await expect(select).toHaveValue(value);
      }
      await page.screenshot({
        path: `artifacts/wo-007/${width}-settings-${value}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
