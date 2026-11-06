import { test, expect, authenticate } from './auth-fixture';
import { mockExtension, openCalls, setScenario } from './extension-helper';
import { presetApi } from './quick-launch-fixture';
import { fixtureId, installProductApi } from './product-fixture';
test.use({ channel: 'chromium' });
const toggle = (page: import('@playwright/test').Page) =>
  page.getByRole('switch', { name: '시크릿 실행 모드', includeHidden: true });
async function enable(page: import('@playwright/test').Page) {
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
}
const link = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'ChatGPT 열기', exact: true });

test('header toggle and adjacent menus keep their geometry through checking, ON and OFF', async ({
  page,
}) => {
  await mockExtension(page, 'delayed-status');
  await page.goto('/links');
  const measure = () =>
    page.getByRole('navigation').evaluate((nav) =>
      [
        ...nav.querySelectorAll('[data-navigation-items] > a, [role="switch"]'),
      ].map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, width: rect.width, height: rect.height };
      }),
    );
  const off = await measure();
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-busy', 'true');
  const checking = await measure();
  await page.evaluate(() => window.extensionProbe.release?.());
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
  const on = await measure();
  await toggle(page).click();
  expect({ checking, on, offAgain: await measure() }).toEqual({
    checking: off,
    on: off,
    offAgain: off,
  });
});
test('mode survives internal navigation; reload/new tab/account change reset; no persistence', async ({
  page,
  context,
}) => {
  await mockExtension(page);
  await page.goto('/links');
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  await enable(page);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '설정', exact: true })
    .click();
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  await enable(page);
  const tab = await context.newPage();
  await tab.goto('/links');
  await expect(toggle(tab)).toHaveAttribute('aria-checked', 'false');
  await tab.close();
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new FocusEvent('focus')));
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  expect(
    await page.evaluate(() =>
      [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter(
        (key) => /incognito|launch.mode/i.test(key),
      ),
    ),
  ).toEqual([]);
});
for (const scenario of [
  'transport',
  'invalid',
  'timeout',
  'denied',
  'old',
  'no-api',
  'unsupported',
])
  test(`toggle keeps OFF and distinguishes ${scenario}`, async ({ page }) => {
    await mockExtension(page, scenario);
    await page.goto('/links');
    await toggle(page).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
    if (scenario === 'denied')
      await expect(page.getByRole('alertdialog')).toContainText(
        '시크릿 모드 허용이 필요합니다.',
      );
    if (scenario === 'old')
      await expect(page.getByRole('alertdialog')).toContainText('업데이트');
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(toggle(page)).toBeFocused();
  });
test('permission retry enables without confirmation; pending cancel ignores stale permission', async ({
  page,
}) => {
  await mockExtension(page, 'denied');
  await page.goto('/links');
  await toggle(page).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await setScenario(page, 'success');
  await page.getByRole('button', { name: '연결 확인', exact: true }).click();
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
  await toggle(page).click();
  await setScenario(page, 'delayed-status');
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-busy', 'true');
  await toggle(page).click();
  await page.evaluate(() => window.extensionProbe.release?.());
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  expect(
    await page.evaluate(
      () =>
        window.extensionProbe.calls.filter((c) => c.type === 'BISEO_GET_STATUS')
          .length,
    ),
  ).toBe(3);
});
for (const input of [
  'click',
  'enter',
  'control',
  'meta',
  'shift',
  'middle',
  'new-tab',
])
  test(`secret ${input} sends once, records after success, never opens normal context`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    await mockExtension(page);
    await page.goto(
      input === 'new-tab' ? `/links/${fixtureId('chatgpt')}` : '/links',
    );
    await enable(page);
    const target =
      input === 'new-tab'
        ? page.getByRole('button', { name: '새 탭에서 열기', exact: true })
        : link(page);
    expect(await target.getAttribute('href')).toBeNull();
    const before = context.pages().length;
    if (input === 'enter') {
      await target.focus();
      await target.press('Enter');
    } else
      await target.click(
        input === 'middle'
          ? { button: 'middle' }
          : input === 'control'
            ? { modifiers: ['Control'] }
            : input === 'meta'
              ? { modifiers: ['Meta'] }
              : input === 'shift'
                ? { modifiers: ['Shift'] }
                : {},
      );
    await expect.poll(async () => (await openCalls(page)).length).toBe(1);
    await expect
      .poll(() => api.requests.filter((r) => r.url().endsWith('/open')).length)
      .toBe(1);
    expect(context.pages().length).toBe(before);
    expect(await page.evaluate(() => window.extensionProbe.windowOpens)).toBe(
      0,
    );
  });
test('pending secret single activation locks synchronously and records only after acknowledgment', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await mockExtension(page);
  await page.goto('/links');
  await enable(page);
  await setScenario(page, 'delayed-open');
  await link(page).evaluate((node: HTMLButtonElement) => {
    node.click();
    node.click();
  });
  expect((await openCalls(page)).length).toBe(1);
  expect(api.requests.filter((r) => r.url().endsWith('/open'))).toHaveLength(0);
  await page.evaluate(() => window.extensionProbe.release?.());
  await expect
    .poll(() => api.requests.filter((r) => r.url().endsWith('/open')).length)
    .toBe(1);
});
for (const scenario of ['unknown', 'revoked', 'open-timeout', 'bad-count'])
  test(`single ${scenario} has no record, fallback or automatic resend`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    await mockExtension(page);
    await page.goto('/links');
    await enable(page);
    await setScenario(page, scenario);
    await link(page).click();
    await expect(page.locator('p[role="alert"]')).toBeVisible();
    expect((await openCalls(page)).length).toBe(1);
    expect(api.requests.filter((r) => r.url().endsWith('/open'))).toHaveLength(
      0,
    );
    await expect(
      page.getByRole('link', { name: '기록 없이 열기', exact: true }),
    ).toHaveCount(0);
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
  });
test('record failure never reopens a confirmed secret window', async ({
  page,
}) => {
  await mockExtension(page);
  await page.goto('/links');
  await enable(page);
  await page.route('**/links/*/open', (r) =>
    r.fulfill({
      status: 500,
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: {},
    }),
  );
  await link(page).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    '시크릿 창은 열렸지만',
  );
  expect((await openCalls(page)).length).toBe(1);
});
for (const scenario of [
  'success',
  'partial',
  'unknown',
  'revoked',
  'open-timeout',
])
  test(`preset ${scenario}: ordered batch once, no per-URL guesses`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const presets = await presetApi(page);
    await mockExtension(page);
    await page.goto('/');
    await enable(page);
    await setScenario(page, scenario);
    await page.getByRole('button', { name: '실행', exact: true }).click();
    if (scenario === 'success')
      await expect
        .poll(
          () => api.requests.filter((r) => r.url().endsWith('/open')).length,
        )
        .toBe(2);
    else await expect(page.locator('p[role="alert"]')).toBeVisible();
    const calls = await openCalls(page);
    expect(calls).toEqual([
      {
        type: 'BISEO_OPEN_URLS',
        version: 1,
        mode: 'incognito',
        urls: presets.items[0]!.links.map((item) => item.link.url),
      },
    ]);
    if (scenario !== 'success')
      expect(
        api.requests.filter((r) => r.url().endsWith('/open')),
      ).toHaveLength(0);
    expect(await page.evaluate(() => window.extensionProbe.windowOpens)).toBe(
      0,
    );
  });
test('preset pending lock lasts through response; individual member also uses secret mode', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await presetApi(page);
  await mockExtension(page);
  await page.goto('/');
  await enable(page);
  await setScenario(page, 'delayed-open');
  const run = page.getByRole('button', { name: '실행', exact: true });
  await run.click();
  await page.waitForTimeout(1100);
  await expect(run).toBeDisabled();
  await page.evaluate(() => window.extensionProbe.release?.());
  await expect(run).toBeEnabled();
  await expect
    .poll(() => api.requests.filter((r) => r.url().endsWith('/open')).length)
    .toBe(2);
  await setScenario(page, 'success');
  await page
    .getByRole('button', { name: /개별 열기/ })
    .first()
    .click();
  await expect
    .poll(() => api.requests.filter((r) => r.url().endsWith('/open')).length)
    .toBe(3);
  expect(
    (await openCalls(page)).map((r) =>
      r.type === 'BISEO_OPEN_URLS' ? r.urls.length : 0,
    ),
  ).toEqual([2, 1]);
});
test('mobile boundary resets to normal and discards pending status, desktop returns OFF', async ({
  page,
}) => {
  await mockExtension(page);
  await page.goto('/links');
  await enable(page);
  await page.setViewportSize({ width: 1023, height: 900 });
  await expect(toggle(page)).toBeHidden();
  await expect(
    page.getByRole('link', { name: 'ChatGPT 열기', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  await setScenario(page, 'delayed-status');
  await toggle(page).click();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => window.extensionProbe.release?.());
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
});

for (const entry of [
  '/',
  `/category/${fixtureId('ai')}`,
  `/links/${fixtureId('chatgpt')}`,
])
  test(`secret single execution from ${entry}`, async ({ page, context }) => {
    const api = await installProductApi(context);
    await mockExtension(page);
    await page.goto(entry);
    await enable(page);
    await page
      .getByRole('button', {
        name: entry.startsWith('/links/') ? '링크 열기' : 'ChatGPT 열기',
        exact: true,
      })
      .click();
    await expect
      .poll(() => api.requests.filter((r) => r.url().endsWith('/open')).length)
      .toBe(1);
    expect((await openCalls(page)).length).toBe(1);
    await expect(page).toHaveURL(entry);
  });

for (const size of [8, 9])
  test(`secret preset validates all ${size} members without truncation or splitting`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const presets = await presetApi(page);
    const seed = presets.items[0]!.links[0]!.link;
    presets.items[0]!.links = Array.from({ length: size }, (_, i) => ({
      sortOrder: i,
      link: { ...seed, id: fixtureId(`limit-${i}`) },
    }));
    presets.items[0]!.linkCount = size;
    await mockExtension(page);
    await page.goto('/');
    await enable(page);
    await page.getByRole('button', { name: '실행', exact: true }).click();
    if (size === 9) {
      await expect(
        page.getByRole('alert').filter({ hasText: '1~8개' }),
      ).toBeVisible();
      expect(await openCalls(page)).toEqual([]);
      expect(
        api.requests.filter((r) => r.url().endsWith('/open')),
      ).toHaveLength(0);
    } else {
      await expect.poll(async () => (await openCalls(page)).length).toBe(1);
      expect((await openCalls(page))[0]).toMatchObject({
        urls: Array(8).fill(seed.url),
      });
    }
  });

test('one unsafe preset URL rejects the entire batch before dispatch or recording', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const presets = await presetApi(page);
  presets.items[0]!.links[1]!.link.url = 'javascript:alert(1)';
  await mockExtension(page);
  await page.goto('/');
  await enable(page);
  await page.getByRole('button', { name: '실행', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: '1~8개' }),
  ).toBeVisible();
  expect(await openCalls(page)).toEqual([]);
  expect(api.requests.filter((r) => r.url().endsWith('/open'))).toHaveLength(0);
});

test('account change ignores old permission response; logout clears secret mode', async ({
  page,
  context,
}) => {
  await mockExtension(page, 'delayed-status');
  await page.goto('/links');
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-busy', 'true');
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(toggle(page)).not.toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => window.extensionProbe.release?.());
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  await setScenario(page, 'success');
  await enable(page);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '설정', exact: true })
    .click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(toggle(page)).toHaveCount(0);
});

test('keyboard toggle, OFF return and header bounds at desktop boundary', async ({
  page,
}) => {
  await mockExtension(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/links');
  await toggle(page).focus();
  await page.keyboard.press('Space');
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  await expect(
    page.getByRole('link', { name: 'ChatGPT 열기', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const nav = await page.getByRole('navigation').boundingBox();
  expect(nav?.height).toBe(64);
  await enable(page);
  await page.screenshot({
    path: 'artifacts/wo-fe-ext-01/header-1024.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: 'artifacts/wo-fe-ext-01/header-1440.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'artifacts/wo-fe-ext-01/mobile-390.png',
    fullPage: true,
  });
});

test('pending secret dispatch stays locked across internal navigation and ignores old account results', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await mockExtension(page);
  await page.goto('/links');
  await enable(page);
  await setScenario(page, 'delayed-open');
  await link(page).click();
  await expect.poll(async () => (await openCalls(page)).length).toBe(1);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '홈', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '링크비서 홈', exact: true }),
  ).toBeVisible();
  await link(page).click();
  await expect(page.locator('p[role="alert"]')).toContainText('처리 중');
  expect((await openCalls(page)).length).toBe(1);
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  await page.evaluate(() => window.extensionProbe.release?.());
  expect(api.requests.filter((r) => r.url().endsWith('/open'))).toHaveLength(0);
});

test('committed secret Open marks usage stale and settings reuses existing summary query', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await mockExtension(page);
  await page.goto('/settings');
  await expect(
    page.getByRole('heading', { name: '사용 통계', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  await enable(page);
  await link(page).click();
  await expect
    .poll(() => api.requests.filter((r) => r.url().endsWith('/open')).length)
    .toBe(1);
  const before = api.requests.filter((r) =>
    r.url().includes('/users/me/usage-summary'),
  ).length;
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '설정', exact: true })
    .click();
  await expect
    .poll(
      () =>
        api.requests.filter((r) => r.url().includes('/users/me/usage-summary'))
          .length,
    )
    .toBeGreaterThan(before);
});
