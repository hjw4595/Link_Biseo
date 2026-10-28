import { mkdir } from 'node:fs/promises';
import { test, expect } from './auth-fixture';
import { fixtureId, installProductApi } from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import { bookmarkHtml } from './bookmark-browser-helper';
import { expectLayoutWidth } from './layout-assertions';
import { layoutProfile } from '../src/components/common/app-layout-policy';

const widths = [320, 375, 390, 430, 512, 640, 767, 768, 1023, 1024, 1280, 1440];
const routes = [
  ['home', '/', 'home'],
  ['links', '/links', 'workspace'],
  ['category', `/category/${fixtureId('development')}`, 'workspace'],
  ['import', '/links/import', 'workspace'],
  ['new', '/links/new', 'compact'],
  ['detail', `/links/${fixtureId('chatgpt')}`, 'compact'],
  ['categories', '/categories', 'hub'],
  ['settings', '/settings', 'hub'],
  ['organization', '/assistant/organization', 'hub'],
] as const;

test('static paths take precedence, unknown and utility routes are compact', () => {
  for (const [, route, profile] of routes)
    expect(layoutProfile(route)).toBe(profile);
  for (const route of [
    '/login',
    '/diagnostics',
    '/dev/ui',
    '/missing',
    '/links/newer',
  ])
    expect(layoutProfile(route)).toBe('compact');
});

for (const width of widths)
  test(`all profiles and one accessible navigation at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mkdir('artifacts/wo-v1-03/screenshots', { recursive: true });
    for (const [name, route, profile] of routes) {
      await page.goto(route);
      const nav = page.getByRole('navigation', {
        name: '주요 메뉴',
        includeHidden: name === 'new',
      });
      await expect(nav).toBeVisible();
      await expect(page.locator('[data-layout-profile]')).toHaveAttribute(
        'data-layout-profile',
        profile,
      );
      await expectLayoutWidth(page);
      await expect(nav).toHaveCount(1);
      await expect(
        nav
          .locator('[data-navigation-items]')
          .getByRole('link', { includeHidden: name === 'new' }),
      ).toHaveCount(4);
      await expect(nav.locator('[aria-current=page]')).toHaveCount(1);
      const shell = await page.locator('[data-layout-profile]').boundingBox();
      const menu = await nav.boundingBox();
      if (!shell || !menu) throw new Error('Missing shell');
      const expectedNavWidth =
        width >= 1024 ? Math.min(width, 1152) : shell.width;
      expect(menu.width).toBe(expectedNavWidth);
      expect(menu.x).toBe((width - expectedNavWidth) / 2);
      if (width >= 1024) expect(menu.height).toBe(64);
      expect(shell.x).toBe((width - shell.width) / 2);
      expect(await nav.evaluate((el) => getComputedStyle(el).position)).toBe(
        width < 1024 ? 'fixed' : 'static',
      );
      const padding = await page
        .locator('main')
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
      expect(padding).toBe(width < 1024 ? 88 : 0);
      if (width < 1024) expect(menu.y + menu.height).toBe(900);
      else expect(menu.y).toBe(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `artifacts/wo-v1-03/screenshots/${name}-${width}.png`,
          fullPage: true,
        });
    }
  });

test('resize preserves search, cache, auth and the navigation DOM node', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/links?q=ChatGPT');
  const input = page.getByRole('searchbox', { name: '저장한 링크 검색' });
  await expect(input).toHaveValue('ChatGPT');
  await expect(page.getByTestId('link-item').first()).toBeVisible();
  const requests = api.requests.length;
  const menu = await page.getByRole('navigation').elementHandle();
  for (const width of [767, 768, 1023, 1024, 1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(input).toHaveValue('ChatGPT');
    expect(await menu?.evaluate((el) => el.isConnected)).toBe(true);
    await expectLayoutWidth(page);
  }
  expect(api.requests.length).toBe(requests);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '설정', exact: true })
    .click();
  await expect(page).toHaveURL('/settings');
  await page.goBack();
  await expect(input).toHaveValue('ChatGPT');
});

test('preset Sheet draft, scroll, focus trap and return focus survive breakpoint changes', async ({
  page,
}) => {
  const api = await presetApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  const trigger = page.getByRole('button', {
    name: '편집',
    exact: true,
  });
  await trigger.click();
  await page
    .getByLabel('이름', { exact: true })
    .fill('반응형 draft 日本語 English');
  const sheet = page.getByRole('dialog');
  const handle = await sheet.elementHandle();
  for (const width of [1024, 1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel('이름', { exact: true })).toHaveValue(
      '반응형 draft 日本語 English',
    );
    expect(await handle?.evaluate((el) => el.isConnected)).toBe(true);
    await expect
      .poll(async () => Math.round((await sheet.boundingBox())!.width))
      .toBe(width < 1024 ? width : 512);
    await expect
      .poll(async () => Math.round((await sheet.boundingBox())!.height))
      .toBe(900);
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return Math.round(box!.x + box!.width);
      })
      .toBe(width);
    await page.getByLabel('이름', { exact: true }).focus();
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      expect(
        await sheet.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.screenshot({
      path: `artifacts/wo-v1-03/screenshots/preset-${width}.png`,
      animations: 'disabled',
    });
  }
  expect(api.requests.filter((r) => r.method !== 'GET')).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(
    page.getByText('저장하지 않은 변경사항을 버릴까요?'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '변경사항 버리기', exact: true })
    .click();
  await expect(sheet).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '링크비서 홈' }),
  ).toBeFocused();
});

test('bookmark selection persists through resize without POST or reanalysis', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.goto('/links/import');
  // Wait for client hydration before dispatching a file-input change event.
  await expect
    .poll(() =>
      api.requests.some(
        (request) => new URL(request.url()).pathname === '/categories',
      ),
    )
    .toBe(true);
  await page.getByLabel('HTML 파일 선택', { exact: true }).setInputFiles({
    name: 'bookmarks.html',
    mimeType: 'text/html',
    buffer: Buffer.from(bookmarkHtml(3)),
  });
  await expect(
    page.getByRole('button', { name: '선택한 링크 가져오기', exact: true }),
  ).toBeEnabled();
  const checkbox = page.getByRole('checkbox').first();
  await checkbox.uncheck();
  const requests = api.requests.length;
  for (const width of [390, 1024, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(checkbox).not.toBeChecked();
    await expect(
      page.getByText('선택한 파일:', { exact: false }),
    ).toBeVisible();
  }
  expect(api.requests.length).toBe(requests);
  expect(api.requests.filter((r) => r.method() !== 'GET')).toHaveLength(0);
});

test('desktop navigation keyboard and 200 percent CSS zoom reflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/links');
  const nav = page.getByRole('navigation');
  await nav.getByRole('link', { name: '홈', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(
    nav.getByRole('link', { name: '카테고리', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/categories');
  // Browser zoom halves the CSS viewport; deviceScaleFactor alone is not zoom.
  await page.setViewportSize({ width: 720, height: 450 });
  await expectLayoutWidth(page);
  expect(await nav.evaluate((el) => getComputedStyle(el).position)).toBe(
    'fixed',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(720);
});

test('pending preset save survives breakpoint changes without duplicate submission', async ({
  page,
}) => {
  const api = await presetApi(page, 0);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route(
    'http://127.0.0.1:54329/quick-launch-presets',
    async (route) => {
      if (route.request().method() === 'POST') {
        posts++;
        await gate;
      }
      await route.fallback();
    },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page
    .getByRole('button', { name: '빠른 실행 추가', exact: true })
    .click();
  await page.getByLabel('이름', { exact: true }).fill('저장 중 화면 전환');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  try {
    await expect.poll(() => posts).toBe(1);
    for (const width of [1440, 767, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByLabel('이름', { exact: true })).toHaveValue(
        '저장 중 화면 전환',
      );
      await expect(
        page.getByRole('button', { name: '추가', exact: true }),
      ).toBeDisabled();
      expect(posts).toBe(1);
    }
  } finally {
    release();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(api.requests.filter((r) => r.method === 'POST')).toHaveLength(1);
  await expect(
    page.getByRole('region', { name: '빠른 실행', exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByRole('listitem', {
      name: '빠른 실행 저장 중 화면 전환',
      exact: true,
    }),
  ).toBeVisible();
});
