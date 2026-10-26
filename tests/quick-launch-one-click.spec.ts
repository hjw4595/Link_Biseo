import { mkdir, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, authenticate } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';
import { expectLayoutWidth } from './layout-assertions';

const root = 'artifacts/wo-ui-02';
const card = (page: Page, n = 1) =>
  page.getByRole('listitem', { name: `빠른 실행 업무 ${n}`, exact: true });
const run = (page: Page) =>
  card(page).getByRole('button', { name: '실행', exact: true });
async function stubOpens(page: Page) {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    Object.defineProperty(window, '__oneClickOpens', { value: calls });
    window.open = (...args) => {
      calls.push(args);
      return null;
    };
  });
}
async function calls(page: Page): Promise<unknown> {
  return page.evaluate(() => Reflect.get(window, '__oneClickOpens'));
}
async function shot(page: Page, name: string) {
  await mkdir(`${root}/screenshots`, { recursive: true });
  await page.screenshot({
    path: `${root}/screenshots/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

for (const width of [390, 768, 1023, 1024, 1280, 1440, 1920]) {
  test(`one-click breakpoint and bounded initial reads ${width}`, async ({
    page,
  }) => {
    const api = await presetApi(page, 50);
    await stubOpens(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByTestId('link-item')).toHaveCount(3);
    await expect(
      page.getByRole('button', { name: '실행 준비', exact: true }),
    ).toHaveCount(0);
    if (width < 1024) {
      await expect(
        page.getByRole('region', { name: '빠른 실행', exact: true }),
      ).toHaveCount(0);
      expect(api.requests).toEqual([]);
    } else {
      await expect(run(page)).toBeEnabled();
      await expect.poll(() => api.requests.length).toBe(7);
      expect(api.requests.map((r) => r.path).sort()).toEqual(
        [
          '/quick-launch-presets',
          ...api.items.slice(0, 6).map((p) => `/quick-launch-presets/${p.id}`),
        ].sort(),
      );
      await expect(
        page.getByRole('button', { name: '실행', exact: true }),
      ).toHaveCount(6);
    }
    await expectLayoutWidth(page);
    expect(errors).toEqual([]);
    expect(await calls(page)).toEqual([]);
    await shot(page, `home-${width}`);
    await writeFile(
      `${root}/reads-${width}.json`,
      JSON.stringify({ width, api: 'Mock', requests: api.requests }, null, 2),
    );
  });
}

test('extra cards load on visibility and reuse fresh cache across scroll and accordion', async ({
  page,
}) => {
  const api = await presetApi(page, 50);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(run(page)).toBeEnabled();
  await expect.poll(() => api.requests.length).toBe(7);
  await page.getByRole('button', { name: '나머지 44개 보기' }).click();
  await expect(
    page.getByRole('list', { name: '빠른 실행 목록' }).locator(':scope > li'),
  ).toHaveCount(50);
  expect(api.requests.length).toBeLessThan(20);
  expect(api.requests.some((r) => r.path.endsWith(api.items[20]!.id))).toBe(
    false,
  );
  const last = card(page, 50);
  await last.scrollIntoViewIfNeeded();
  await expect(
    last.getByRole('button', { name: '실행', exact: true }),
  ).toBeEnabled();
  const reads = () =>
    api.requests.filter((r) => r.path.endsWith(api.items[49]!.id)).length;
  expect(reads()).toBe(1);
  await last.getByRole('button', { name: '업무 50 펼치기' }).click();
  await expect(last.getByRole('list')).toBeVisible();
  await last.getByRole('button', { name: '업무 50 접기' }).click();
  await card(page).scrollIntoViewIfNeeded();
  await last.scrollIntoViewIfNeeded();
  await expect(
    last.getByRole('button', { name: '실행', exact: true }),
  ).toBeEnabled();
  expect(reads()).toBe(1);
  expect(api.requests.some((r) => r.path.endsWith(api.items[20]!.id))).toBe(
    false,
  );
  await shot(page, 'visible-extra-card');
});

test('disabled loading never queues execution; a ready click opens synchronously with stable button size', async ({
  page,
}) => {
  await presetApi(page, 1);
  await stubOpens(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/quick-launch-presets/*', async (route) => {
    await gate;
    await route.fallback();
  });
  await page.goto('/');
  await expect(run(page)).toHaveAttribute('aria-busy', 'true');
  await expect(run(page)).toBeDisabled();
  const before = await run(page).boundingBox();
  await run(page).evaluate((button: HTMLButtonElement) => button.click());
  expect(await calls(page)).toEqual([]);
  await shot(page, 'loading');
  release();
  await expect(run(page)).toBeEnabled();
  expect(await calls(page)).toEqual([]);
  const ready = await run(page).boundingBox();
  expect({ w: ready?.width, h: ready?.height }).toEqual({
    w: before?.width,
    h: before?.height,
  });
  const beforeClick = await page.evaluate(() => performance.now());
  const synchronous = await run(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    return Reflect.get(window, '__oneClickOpens');
  });
  expect(synchronous).toHaveLength(2);
  await expect(run(page)).toBeDisabled();
  await shot(page, 'execution-and-fallback');
  await expect(page.getByRole('link', { name: /개별 열기/ })).toHaveCount(2);
  await writeFile(
    `${root}/synchronous.json`,
    JSON.stringify(
      {
        beforeClick,
        opensBeforeClickReturned: synchronous,
        note: 'Same-call-stack test with window.open stub; real browser click observations are separate.',
      },
      null,
      2,
    ),
  );
});

test('detail error is visible while collapsed and retries explicitly without queued launch', async ({
  page,
}) => {
  const api = await presetApi(page, 1);
  api.detailFailure = 500;
  await stubOpens(page);
  await page.clock.install();
  await page.goto('/');
  await expect(card(page).getByRole('alert')).toBeVisible();
  await expect(run(page)).toBeDisabled();
  await shot(page, 'detail-error');
  await page.clock.fastForward(60000);
  expect(
    api.requests.filter((r) => r.path !== '/quick-launch-presets'),
  ).toHaveLength(1);
  api.detailFailure = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/quick-launch-presets/*', async (route) => {
    await gate;
    await route.fallback();
  });
  await card(page).getByRole('button', { name: '다시 불러오기' }).click();
  await expect(run(page)).toHaveAttribute('aria-busy', 'true');
  await shot(page, 'retry-loading');
  release();
  await expect(run(page)).toBeEnabled();
  expect(await calls(page)).toEqual([]);
  await shot(page, 'ready');
});

test('elapsed age alone stays ready; reconnect revalidates and blocks changed URL execution', async ({
  page,
}) => {
  const api = await presetApi(page, 1);
  await stubOpens(page);
  await page.clock.install();
  await page.goto('/');
  await expect(run(page)).toBeEnabled();
  const changed = 'https://example.com/updated-one-click';
  api.items[0]!.links[0]!.link.url = changed;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/quick-launch-presets/*', async (route) => {
    await gate;
    await route.fallback();
  });
  await page.clock.fastForward(16000);
  await expect(run(page)).toBeEnabled();
  expect(
    api.requests.filter((r) => r.path !== '/quick-launch-presets'),
  ).toHaveLength(1);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  await expect(run(page)).toBeDisabled();
  await expect(run(page)).not.toHaveAttribute('aria-busy', 'true');
  await run(page).evaluate((button: HTMLButtonElement) => button.click());
  expect(await calls(page)).toEqual([]);
  release();
  await expect(run(page)).toBeEnabled();
  await run(page).click();
  expect(await calls(page)).toEqual([
    [changed, '_blank', 'noopener,noreferrer'],
    [api.items[0]!.links[1]!.link.url, '_blank', 'noopener,noreferrer'],
  ]);
});

test('empty preset is disabled; editing automatically refreshes name and member order', async ({
  page,
}) => {
  const api = await presetApi(page, 2);
  api.items[1]!.links = [];
  api.items[1]!.linkCount = 0;
  await stubOpens(page);
  await page.goto('/');
  await expect(run(page)).toBeEnabled();
  await expect(
    card(page, 2).getByRole('button', { name: '실행', exact: true }),
  ).toBeDisabled();
  await shot(page, 'empty-and-ready');
  await card(page).getByRole('button', { name: '업무 1 펼치기' }).click();
  await card(page).getByRole('button', { name: '편집' }).click();
  await page.getByLabel('이름', { exact: true }).fill('변경된 묶음');
  await page
    .getByRole('list', { name: '선택한 링크 순서' })
    .getByRole('button', { name: /아래로/ })
    .first()
    .click();
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const changed = page.getByRole('listitem', {
    name: '빠른 실행 변경된 묶음',
    exact: true,
  });
  await expect(
    changed.getByRole('button', { name: '실행', exact: true }),
  ).toBeEnabled();
  await changed.getByRole('button', { name: '실행', exact: true }).click();
  const saved = api.items.find((p) => p.name === '변경된 묶음')!;
  expect(await calls(page)).toEqual(
    saved.links
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => [row.link.url, '_blank', 'noopener,noreferrer']),
  );
  expect(
    api.requests.filter((r) => r.path.endsWith(saved.id) && r.method === 'GET')
      .length,
  ).toBeGreaterThanOrEqual(2);
});

test('mobile transition stops new details and account switch clears A execution', async ({
  page,
  context,
}) => {
  const api = await presetApi(page, 8);
  await stubOpens(page);
  await page.goto('/');
  await expect(run(page)).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(
    page.getByRole('region', { name: '빠른 실행', exact: true }),
  ).toHaveCount(0);
  const afterMobile = api.requests.length;
  await page.clock.install();
  await page.clock.fastForward(20000);
  expect(api.requests).toHaveLength(afterMobile);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(run(page)).toBeEnabled();
  await authenticate(context, false, 'alternate');
  api.items = [];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toHaveCount(0);
  expect(await calls(page)).toEqual([]);
});
