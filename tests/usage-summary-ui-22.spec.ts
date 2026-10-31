import { bookmarkHtml } from './bookmark-browser-helper';
import { requestLinkDeletion } from './link-actions-helper';
import { mkdir, readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, authenticate, testUser } from './auth-fixture';
import { installProductApi, initialProduct } from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import { isUsageSummaryResponse } from '../src/contracts/usage-summary';
import { dateInZone } from '../src/lib/time-zone';
const root = 'artifacts/wo-ui-22/implementation';
const endpoint = '**/users/me/usage-summary?**';
function response(used = 12, opens = 46, timezone = 'UTC', now = Date.now()) {
  const periodEndDate = dateInZone(now, timezone);
  const start = new Date(`${periodEndDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    recent7DayUsedLinkCount: used,
    recent7DayOpenCount: opens,
    timezone,
    periodStartDate: start.toISOString().slice(0, 10),
    periodEndDate,
    historyScope: 'currently_saved_links',
  };
}
const usedCard = (page: Page) =>
  page.locator('[aria-label="최근 7일 사용한 링크"]');
const openCard = (page: Page) => page.locator('[aria-label="최근 7일 실행"]');
async function usage(page: Page, used = 12, opens = 46) {
  await page.route(endpoint, (route) =>
    route.fulfill({
      json: response(
        used,
        opens,
        new URL(route.request().url()).searchParams.get('timeZone')!,
      ),
    }),
  );
}
async function total(page: Page, n: number) {
  const state = initialProduct();
  await page.route('**/categories/summary', (route) =>
    route.fulfill({
      json: {
        items: state.categories.map((c, i) => ({
          id: c.id,
          linkCount: i === 0 ? n : 0,
        })),
        uncategorizedCount: 0,
        totalLinkCount: n,
      },
    }),
  );
}
async function shot(page: Page, name: string) {
  await mkdir(root + '/screenshots', { recursive: true });
  await page.screenshot({
    path: `${root}/screenshots/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}
for (const width of [320, 390, 512, 768, 1024, 1440, 1920])
  test(`real-contract cards, rate and donut at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await usage(page);
    await total(page, 128);
    await page.goto('/settings');
    await expect(usedCard(page)).toContainText('12개');
    await expect(usedCard(page)).toContainText('전체의 9.4%');
    await expect(openCard(page)).toContainText('46회');
    await expect(page.locator('[aria-label="전체 링크"]')).toContainText(
      '128개',
    );
    await expect(page.getByTestId('donut-center')).toHaveText('128전체 링크');
    await expect(page.getByText('집계 연동 예정')).toHaveCount(0);
    await expect(page.locator('[aria-label="즐겨찾기"]')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await shot(page, `settings-${width}`);
  });
for (const [name, used, opens, n, rate] of [
  ['empty', 0, 0, 0, '0%'],
  ['unused', 0, 0, 128, '0.0%'],
  ['repeated-one', 1, 10, 3, '33.3%'],
  ['distinct-three', 3, 10, 3, '100.0%'],
] as const)
  test(`metric semantics ${name}`, async ({ page }) => {
    await usage(page, used, opens);
    await total(page, n);
    await page.goto('/settings');
    await expect(usedCard(page)).toContainText(`${used}개`);
    await expect(usedCard(page)).toContainText(`전체의 ${rate}`);
    await expect(openCard(page)).toContainText(`${opens}회`);
    await shot(page, name);
  });
test('contract matches actual PostgreSQL Backend result', async () => {
  // Sanitized response captured from the real Nest/PostgreSQL integration.
  // Keep the standard FE suite independent of sibling repositories/live credentials.
  const actual: unknown = JSON.parse(
    await readFile('tests/fixtures/usage-summary-real-response.json', 'utf8'),
  );
  expect(isUsageSummaryResponse(actual)).toBe(true);
});

for (const [field, value] of [
  ['recent7DayUsedLinkCount', -1],
  ['recent7DayUsedLinkCount', 0.1],
  ['recent7DayUsedLinkCount', NaN],
  ['recent7DayOpenCount', Infinity],
  ['recent7DayOpenCount', Number.MAX_SAFE_INTEGER + 1],
  ['recent7DayOpenCount', '46'],
  ['recent7DayOpenCount', 11],
  ['historyScope', 'all_history'],
  ['timezone', 'Mars/No'],
  ['periodStartDate', '2026-02-30'],
  ['periodEndDate', '2026-01-01'],
] as const)
  test(`validator rejects ${field} ${String(value)}`, () => {
    expect(isUsageSummaryResponse({ ...response(), [field]: value })).toBe(
      false,
    );
  });
for (const status of [400, 401, 500])
  test(`HTTP ${status} never becomes zero and retry succeeds`, async ({
    page,
  }) => {
    let calls = 0;
    await page.route(endpoint, (route) => {
      calls++;
      return route.fulfill({ status, json: {} });
    });
    await page.goto('/settings');
    await expect(
      page.getByText('사용 통계를 불러오지 못했어요.', { exact: true }),
    ).toBeVisible();
    expect(calls).toBe(status === 401 ? 2 : 1);
    await expect(usedCard(page)).toContainText('조회 실패');
    await expect(usedCard(page).getByText(/전체의/)).toHaveCount(0);
    await expect(
      page.getByLabel('미사용 링크 추천 기간', { exact: true }),
    ).toBeEnabled();
    await shot(page, `error-${status}`);
    await page.unroute(endpoint);
    await usage(page, 1, 10);
    await page
      .getByRole('main')
      .getByRole('button', { name: '다시 시도', exact: true })
      .click();
    await expect(usedCard(page)).toContainText('1개');
    await expect(openCard(page)).toContainText('10회');
  });
test('loading is local, background error retains dated data, explicit retry recovers', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  let failed = false;
  await page.route(endpoint, async (route) => {
    await gate;
    await route.fulfill(
      failed
        ? { status: 500, json: {} }
        : {
            json: response(
              2,
              7,
              new URL(route.request().url()).searchParams.get('timeZone')!,
            ),
          },
    );
  });
  await page.clock.install();
  await page.goto('/settings');
  await expect(usedCard(page)).toContainText('불러오는 중…');
  await expect(usedCard(page)).not.toContainText('0개');
  await expect(
    page.getByLabel('미사용 링크 추천 기간', { exact: true }),
  ).toBeEnabled();
  await shot(page, 'loading');
  release();
  await expect(usedCard(page)).toContainText('2개');
  failed = true;
  await page.clock.fastForward(16000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  await expect(
    page.getByText(
      '사용 통계를 갱신하지 못했어요. 이전 조회 값을 표시하고 있어요.',
    ),
  ).toBeVisible();
  await expect(usedCard(page)).toContainText('2개');
  await expect(openCard(page)).toContainText('7회');
  await expect(usedCard(page).getByText(/전체의/)).toHaveCount(0);
  await shot(page, 'background-error');
  failed = false;
  await page
    .getByRole('main')
    .getByRole('button', { name: '다시 시도', exact: true })
    .click();
  await expect(usedCard(page)).toContainText('전체의 25.0%');
});
test('inconsistent snapshots recover once and never clamp or loop', async ({
  page,
}) => {
  let calls = 0;
  await page.route(endpoint, (route) => {
    calls++;
    return route.fulfill({
      json: response(
        12,
        46,
        new URL(route.request().url()).searchParams.get('timeZone')!,
      ),
    });
  });
  await total(page, 8);
  await page.goto('/settings');
  await expect(
    page.getByText(
      '전체 링크 수와 사용 통계의 조회 시점이 달라요. 다시 확인해 주세요.',
    ),
  ).toBeVisible();
  await expect.poll(() => calls).toBe(2);
  await expect(usedCard(page)).toContainText('12개');
  await expect(usedCard(page).getByText(/전체의/)).toHaveCount(0);
  await total(page, 128);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(usedCard(page)).toContainText('전체의 9.4%');
  expect(calls).toBe(3);
});
test('calendar rollover and timezone change use new owner-zone-day cache keys', async ({
  page,
}) => {
  const zones: string[] = [];
  await page.route(endpoint, (route) => {
    const zone = new URL(route.request().url()).searchParams.get('timeZone')!;
    zones.push(zone);
    return route.fulfill({ json: response(0, 0, zone) });
  });
  await page.goto('/settings');
  await expect(usedCard(page)).toContainText('0개');
  // Change only the device calendar snapshot, preserving auth token time.
  await page.evaluate(() => {
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = new Proxy(original, {
      construct(target, args) {
        const formatter: Intl.DateTimeFormat = Reflect.construct(target, args);
        if (args[0] === 'en-CA') {
          const format = formatter.format;
          Object.defineProperty(formatter, 'format', {
            value: (value: number | Date) =>
              format(new Date(value).getTime() + 86_400_000),
          });
        }
        return formatter;
      },
    });
    window.dispatchEvent(new Event('focus'));
  });
  await expect.poll(() => zones.length).toBe(2);
  await page.evaluate(() => {
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = new Proxy(original, {
      apply(target, thisArg, args) {
        return Reflect.apply(
          target,
          thisArg,
          args.length === 0 ? ['en', { timeZone: 'America/New_York' }] : args,
        );
      },
      construct(target, args) {
        return Reflect.construct(
          target,
          args.length === 0 ? ['en', { timeZone: 'America/New_York' }] : args,
        );
      },
    });
    window.dispatchEvent(new Event('focus'));
  });
  await expect.poll(() => zones.at(-1)).toBe('America/New_York');
});
test('account switch discards prior usage cache', async ({ page, context }) => {
  const api = await installProductApi(context);
  const a = initialProduct();
  a.events.set(a.links[0]!.id, [new Date().toISOString()]);
  api.users.set(testUser.id, a);
  const b = initialProduct();
  b.events.set(b.links[0]!.id, [
    new Date().toISOString(),
    new Date().toISOString(),
  ]);
  b.events.set(b.links[1]!.id, [new Date().toISOString()]);
  api.users.set('22222222-2222-4222-8222-222222222222', b);
  await page.goto('/settings');
  await expect(openCard(page)).toContainText('1회');
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('second@example.test')).toBeVisible();
  await expect(usedCard(page)).toContainText('2개');
  await expect(openCard(page)).toContainText('3회');
});
for (const outcome of ['success', 'failed'] as const)
  test(`normal Open ${outcome} invalidates only after committed record`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    let gets = 0;
    page.on('request', (r) => {
      if (r.url().includes('/usage-summary?')) gets++;
    });
    await page.goto('/settings');
    await expect(openCard(page)).toContainText('0회');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '내 링크', exact: true })
      .click();
    if (outcome === 'failed')
      await page.route('**/links/*/open', (r) =>
        r.fulfill({ status: 500, json: {} }),
      );
    await page.addScriptTag({ content: 'window.open = () => null' });
    await page
      .getByRole('link', { name: 'ChatGPT 열기', exact: true })
      .click({ modifiers: ['ControlOrMeta'] });

    await expect
      .poll(
        () =>
          api.requests.filter(
            (r) => r.method() === 'POST' && r.url().endsWith('/open'),
          ).length + (outcome === 'failed' ? 1 : 0),
      )
      .toBe(1);
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '설정', exact: true })
      .click();
    await expect(openCard(page)).toContainText(
      outcome === 'success' ? '1회' : '0회',
    );
    expect(gets).toBe(outcome === 'success' ? 2 : 1);
    if (outcome === 'success') await shot(page, 'after-normal-open');
  });
for (const partial of [false, true])
  test(`preset batch ${partial ? 'partial' : 'success'} marks stale without per-link usage GET`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    await presetApi(page, 2);
    await page.addInitScript(() => {
      window.open = () => null;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    let gets = 0;
    page.on('request', (r) => {
      if (r.url().includes('/usage-summary?')) gets++;
    });
    await page.goto('/settings');
    await expect(openCard(page)).toContainText('0회');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '홈', exact: true })
      .click();
    let opens = 0;
    if (partial)
      await page.route('**/links/*/open', (route) => {
        opens++;
        return opens === 1
          ? route.fulfill({ status: 500, json: {} })
          : route.fallback();
      });
    await page
      .getByRole('listitem', { name: '빠른 실행 업무 1', exact: true })
      .getByRole('button', { name: '실행', exact: true })
      .click();
    await expect
      .poll(
        () =>
          [...(api.users.get(testUser.id)?.events.values() ?? [])]
            .flat()
            .filter((stamp) => Date.parse(stamp) > Date.now() - 60_000).length,
      )
      .toBe(partial ? 1 : 2);
    expect(gets).toBe(1);
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '설정', exact: true })
      .click();
    await expect.poll(() => gets).toBe(2);
    await expect(openCard(page)).toContainText(partial ? '1회' : '2회');
    await shot(page, partial ? 'after-preset-partial' : 'after-preset');
  });

for (const action of ['register', 'delete', 'import'] as const)
  test(`${action} invalidates usage and updates denominator on settings return`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const state = initialProduct();
    state.events.set(state.links[0]!.id, [new Date().toISOString()]);
    api.users.set(testUser.id, state);
    await page.setViewportSize({ width: 1440, height: 900 });
    let gets = 0;
    page.on('request', (r) => {
      if (r.url().includes('/usage-summary?')) gets++;
    });
    await page.goto('/settings');
    await expect(usedCard(page)).toContainText('1개');
    await expect(usedCard(page)).toContainText('전체의 12.5%');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '내 링크', exact: true })
      .click();
    if (action === 'register') {
      await page.getByRole('link', { name: '링크 등록', exact: true }).click();
      await page.locator('#link-url').fill('https://usage22.example.test/new');
      await page
        .getByRole('dialog', { name: '링크 등록', exact: true })
        .getByRole('button', { name: '링크 등록', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } else if (action === 'delete') {
      await page
        .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
        .click();
      await requestLinkDeletion(page);
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: '링크 삭제', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } else {
      await page
        .getByRole('link', { name: '북마크 가져오기', exact: true })
        .click();
      await page.getByLabel('HTML 파일 선택', { exact: true }).setInputFiles({
        name: 'usage22.html',
        mimeType: 'text/html',
        buffer: Buffer.from(bookmarkHtml(2)),
      });
      await page
        .getByRole('button', { name: '선택한 링크 가져오기', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: '가져오기 처리 결과', exact: true }),
      ).toBeVisible();
    }
    expect(gets).toBe(1);
    await page
      .getByRole('navigation')
      .getByRole('link', { name: '설정', exact: true })
      .click();
    await expect.poll(() => gets).toBe(2);
    await expect(page.locator('[aria-label="전체 링크"]')).toContainText(
      `${action === 'register' ? 9 : action === 'delete' ? 7 : 10}개`,
    );
    await expect(usedCard(page)).toContainText(
      action === 'delete' ? '0개' : '1개',
    );
    await expect(usedCard(page)).toContainText(
      action === 'delete'
        ? '전체의 0.0%'
        : action === 'register'
          ? '전체의 11.1%'
          : '전체의 10.0%',
    );
  });
for (const width of [390, 1440])
  test(`same initialProduct fixture comparison ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/settings');
    await expect(usedCard(page)).toContainText('0개');
    await expect(openCard(page)).toContainText('0회');
    await shot(page, `default-settings-${width}`);
  });

test('valid IANA alias remains valid across browser/server canonical naming', () => {
  expect(
    isUsageSummaryResponse({ ...response(), timezone: 'US/Eastern' }),
  ).toBe(true);
});
test('a response for a different time zone is rejected by API client', async ({
  page,
}) => {
  await page.route(endpoint, (route) =>
    route.fulfill({ json: response(1, 1, 'Pacific/Honolulu') }),
  );
  await page.goto('/settings');
  await expect(
    page.getByText('사용 통계를 불러오지 못했어요.', { exact: true }),
  ).toBeVisible();
  await expect(usedCard(page)).toContainText('조회 실패');
});
