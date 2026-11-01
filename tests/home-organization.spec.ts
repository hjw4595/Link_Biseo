import {
  test,
  expect,
  testUser,
  testSession,
  authenticate,
} from './auth-fixture';
import {
  fixtureId,
  initialProduct,
  installProductApi,
} from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import { mkdir } from 'node:fs/promises';
import { reportToCandidateLinks } from '../src/features/organization/adapters/report-to-recommendations';
import { organizationReport } from './organization-report-data';
const api = 'http://127.0.0.1:54329';
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const root = 'artifacts/wo-ui-15';
function model(count = 2) {
  const state = initialProduct();
  const base = state.links[0]!;
  state.links = [
    {
      ...base,
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      isFavorite: true,
    },
    ...Array.from({ length: count }, (_, i) => ({
      ...base,
      id: fixtureId(`home-candidate-${i}`),
      title: `정리 후보 ${i + 1}`,
      domain: i % 2 ? 'example.com' : 'example.test',
      categoryId: i % 2 ? base.categoryId : null,
      isFavorite: false,
      createdAt: '2020-01-01T00:00:00.000Z',
      lastOpenedAt: null,
    })),
  ];
  return state;
}
test('existing report sections deduplicate IDs, honor Off and bound returned rows without fake global totals', () => {
  const state = model(25);
  state.cleanupThresholdDays = null;
  const report = organizationReport(state);
  const values = reportToCandidateLinks(report);
  expect(values.truncated).toBe(true);
  expect(new Set(values.links.map((link) => link.id)).size).toBe(
    values.links.length,
  );
  expect(values.links.length).toBe(20);
  expect(
    reportToCandidateLinks(report, [values.links[0]!.id]).links,
  ).toHaveLength(19);
  expect(
    reportToCandidateLinks(organizationReport(model(0))).links,
  ).toHaveLength(0);
});
for (const width of [320, 390, 512, 768, 1024, 1440, 1920])
  test(`Home recommendations, detail, confirm and clean My Links ${width}`, async ({
    page,
    context,
    browserName,
  }) => {
    const product = await installProductApi(context);
    const state = model();
    state.links[1]!.title = '긴 제목 日本語 English '.repeat(15);
    product.users.set(testUser.id, state);
    const presets = await presetApi(page, 2);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const toggle = page.getByRole('button', {
      name: '비서의 추천',
      exact: true,
    });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(
      page.getByText('정리가 필요한 링크 2개', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('recommendation-candidate')).toHaveCount(0);
    const reportRequests = () =>
      product.requests.filter(
        (r) => new URL(r.url()).pathname === '/organization-reports',
      );
    expect(reportRequests()).toHaveLength(1);
    expect(
      product.requests.filter((r) =>
        /\/links\/[^/?]+(?:\/stats)?(?:\?|$)/.test(r.url()),
      ),
    ).toHaveLength(0);
    if (width < 1024) {
      expect(presets.requests).toHaveLength(0);
      await expect(
        page.getByRole('region', { name: '빠른 실행', exact: true }),
      ).toHaveCount(0);
    } else
      await expect(
        page.getByRole('region', { name: '빠른 실행', exact: true }),
      ).toBeVisible();
    const dir = `${root}/${browserName}`;
    await mkdir(dir, { recursive: true });
    await page.screenshot({
      path: `${dir}/home-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await toggle.click();
    await expect(page.getByTestId('recommendation-candidate')).toHaveCount(2);
    await expect(
      page.getByRole('link', { name: '전체 보고서', exact: true }),
    ).toHaveAttribute('href', '/assistant/organization');
    const first = page.getByTestId('recommendation-candidate').first();
    await expect(first.locator('.truncate')).toHaveCSS(
      'text-overflow',
      'ellipsis',
    );
    const size = await first
      .getByRole('button', { name: /삭제$/ })
      .boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(44);
    expect(size!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: `${dir}/expanded-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    const title = first.getByRole('button', { name: /상세 보기$/ });
    await title.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    await title.click();
    await expect(
      page.getByRole('dialog', { name: '링크 상세', exact: true }),
    ).toHaveCount(1);
    expect(
      product.requests.filter((r) => r.url().endsWith('/open')),
    ).toHaveLength(0);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `${dir}/detail-${width}.png`,
        animations: 'disabled',
      });
    await page.keyboard.press('Escape');
    await expect(title).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(y);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await first.getByRole('button', { name: /삭제$/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText(
      state.links[1]!.title,
    );
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `${dir}/delete-${width}.png`,
        animations: 'disabled',
      });
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: '취소', exact: true })
      .click();
    await expect(page.getByTestId('recommendation-candidate')).toHaveCount(2);
    expect(product.requests.some((r) => r.method() === 'DELETE')).toBe(false);
    await toggle.click();
    await expect(page.getByTestId('recommendation-candidate')).toHaveCount(0);
    await page.goto('/links');
    await expect(page.getByTestId('link-item')).toHaveCount(3);
    await expect(
      page.getByRole('region', { name: '링크 관리 도구' }),
    ).toHaveCount(0);
    await expect(
      page.getByText('링크별 사용 지표', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: '카테고리 관리', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `${dir}/links-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
for (const count of [0, 1])
  test(`Home candidate ${count} is independent of favorites and presets`, async ({
    page,
    context,
    browserName,
  }) => {
    const product = await installProductApi(context);
    const state = model(count);
    state.links = state.links.slice(1);
    product.users.set(testUser.id, state);
    await presetApi(page, 0);
    const response = page.waitForResponse((r) =>
      r.url().endsWith('/organization-reports'),
    );
    await page.goto('/');
    await response;
    await expect(
      page.getByText('즐겨찾기한 링크가 없어요.', { exact: true }),
    ).toBeVisible();
    const banner = page.getByRole('button', {
      name: '비서의 추천',
      exact: true,
    });
    await expect(banner).toHaveCount(count);
    if (count)
      await expect(
        page.getByText('정리가 필요한 링크 1개', { exact: true }),
      ).toBeVisible();
    await mkdir(`${root}/${browserName}`, { recursive: true });
    await page.screenshot({
      path: `${root}/${browserName}/candidate-${count}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
test('delete error keeps dialog, blocks duplicate requests, retry updates favorite/presets and last-candidate banner', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  const state = model(1);
  state.links = state.links.slice(1);
  state.links[0]!.isFavorite = true;
  product.users.set(testUser.id, state);
  const presets = await presetApi(page, 1);
  let deletes = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${api}/links/${state.links[0]!.id}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    deletes++;
    if (deletes === 1) {
      await gate;
      return route.fulfill({ status: 503, headers: cors, json: {} });
    }
    return route.fallback();
  });
  await page.goto('/');
  const banner = page.getByRole('button', { name: '비서의 추천', exact: true });
  await banner.click();
  await page
    .getByTestId('recommendation-candidate')
    .getByRole('button', { name: /삭제$/ })
    .click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: '링크 삭제', exact: true }).click();
  await expect(
    confirm.getByRole('button', { name: '취소', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(confirm).toBeVisible();
  expect(deletes).toBe(1);
  release();
  await expect(confirm.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  await confirm.getByRole('button', { name: '링크 삭제', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(banner).toHaveCount(0);
  await expect(page.getByTestId('link-item')).toHaveCount(0);
  expect(deletes).toBe(2);
  expect(
    product.requests.filter((r) => r.url().endsWith('/open')),
  ).toHaveLength(0);
  expect(presets.requests.some((r) => r.method === 'GET')).toBe(true);
});
test('successful delete is not resurrected if report refresh fails; Retry repairs the report', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  const state = model(1);
  product.users.set(testUser.id, state);
  let reports = 0;
  let fail = true;
  await page.route(`${api}/organization-reports`, (route) => {
    reports++;
    if (reports > 1 && fail)
      return route.fulfill({ status: 503, headers: cors, json: {} });
    return route.fallback();
  });
  await page.goto('/');
  await page.getByRole('button', { name: '비서의 추천', exact: true }).click();
  await page
    .getByTestId('recommendation-candidate')
    .getByRole('button', { name: /삭제$/ })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '링크 삭제', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '비서의 추천', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '다시 시도', exact: true }),
  ).toBeVisible();
  expect(reports).toBe(2);
  fail = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '다시 시도', exact: true }),
  ).toHaveCount(0);
  expect(reports).toBe(3);
});
test('initial error is unknown, does not loop, and retries to retained background data', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  product.users.set(testUser.id, model());
  let calls = 0;
  let fail = true;
  await page.route(`${api}/organization-reports`, (route) => {
    calls++;
    return fail
      ? route.fulfill({ status: 503, headers: cors, json: {} })
      : route.fallback();
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '다시 시도', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '비서의 추천', exact: true }),
  ).toHaveCount(0);
  expect(calls).toBe(1);
  fail = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(
    page.getByText('정리가 필요한 링크 2개', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '비서의 추천', exact: true }).click();
  await page
    .getByTestId('recommendation-candidate')
    .first()
    .getByRole('button', { name: /상세 보기$/ })
    .click();
  await page.getByRole('button', { name: '정보 수정', exact: true }).click();
  await page.locator('#edit-title').fill('갱신한 후보');
  fail = true;
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '정보 수정', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: '다시 시도', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('recommendation-candidate')).toHaveCount(2);
  expect(calls).toBe(3);
  await expect(page.getByTestId('link-item')).toHaveCount(1);
});
test('seven-day, favorite exemption and Off are server report rules rather than client guesses', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  const state = model(0);
  const base = state.links[0]!;
  state.cleanupThresholdDays = 7;
  state.links = [
    {
      ...base,
      isFavorite: false,
      createdAt: '2020-01-01T00:00:00.000Z',
      lastOpenedAt: null,
    },
    {
      ...base,
      id: fixtureId('recently-used'),
      isFavorite: false,
      createdAt: '2020-01-01T00:00:00.000Z',
      lastOpenedAt: new Date().toISOString(),
    },
    {
      ...base,
      id: fixtureId('favorite-unused'),
      isFavorite: true,
      createdAt: '2020-01-01T00:00:00.000Z',
      lastOpenedAt: null,
    },
  ];
  product.users.set(testUser.id, state);
  await page.goto('/');
  await expect(
    page.getByText('정리가 필요한 링크 1개', { exact: true }),
  ).toBeVisible();
  state.cleanupThresholdDays = null;
  await page.reload();
  await expect
    .poll(
      () =>
        product.requests.filter((r) =>
          r.url().endsWith('/organization-reports'),
        ).length,
    )
    .toBe(2);
  await expect(
    page.getByRole('button', { name: '비서의 추천', exact: true }),
  ).toHaveCount(0);
});
test('favorite and recommendation titles share exactly one detail Sheet and registration stays independent', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  const state = model(1);
  state.links[0]!.categoryId = null;
  product.users.set(testUser.id, state);
  await page.goto('/');
  await page
    .getByRole('region', { name: '즐겨찾기', exact: true })
    .getByRole('button', { name: /상세 보기$/ })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '비서의 추천', exact: true }).click();
  await page
    .getByTestId('recommendation-candidate')
    .first()
    .getByRole('button', { name: /상세 보기$/ })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: '링크 추가', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: '링크 등록', exact: true }),
  ).toHaveCount(1);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '비서의 추천', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  expect(
    product.requests.filter((r) => r.url().endsWith('/open')),
  ).toHaveLength(0);
});
test('A pending report cannot install its private links in B account cache', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  product.users.set(testUser.id, model());
  const other = model(1);
  other.links = other.links.map((link) => ({
    ...link,
    id: fixtureId(`B-${link.id}`),
    title: `B 전용 ${link.title}`,
  }));
  product.users.set(testSession(false, 'alternate').user.id, other);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let waiting = false;
  await page.route(`${api}/organization-reports`, async (route) => {
    const token = route.request().headers().authorization?.split('.')[1];
    const claims: unknown = token
      ? JSON.parse(Buffer.from(token, 'base64url').toString())
      : null;
    const id =
      typeof claims === 'object' && claims !== null && 'sub' in claims
        ? claims.sub
        : '';
    if (id === testUser.id) {
      waiting = true;
      await gate;
    }
    return route.fallback();
  });
  await page.goto('/');
  await expect.poll(() => waiting).toBe(true);
  await authenticate(context, false, 'alternate');
  await page.reload();
  release();
  await expect(
    page.getByText('정리가 필요한 링크 1개', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '비서의 추천', exact: true }).click();
  await expect(page.getByTestId('recommendation-candidate')).toHaveCount(1);
  await expect(page.getByTestId('recommendation-candidate')).toContainText(
    'B 전용',
  );
  await expect(
    page.getByRole('button', { name: '정리 후보 1 상세 보기', exact: true }),
  ).toHaveCount(0);
});

test('deletion during an initial in-flight snapshot never installs the deleted candidate while a newer snapshot waits', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  const state = model(0);
  state.links[0]!.categoryId = null;
  product.users.set(testUser.id, state);
  const snapshot = organizationReport(state);
  let oldRelease = () => {},
    freshRelease = () => {};
  const oldGate = new Promise<void>((resolve) => {
    oldRelease = resolve;
  });
  const freshGate = new Promise<void>((resolve) => {
    freshRelease = resolve;
  });
  let calls = 0;
  await page.route(`${api}/organization-reports`, async (route) => {
    calls++;
    if (calls === 1) {
      await oldGate;
      return route.fulfill({
        status: 200,
        headers: cors,
        json: {
          ...snapshot,
          timeZone: route.request().postDataJSON().timeZone,
        },
      });
    }
    await freshGate;
    return route.fallback();
  });
  await page.goto('/');
  await expect.poll(() => calls).toBe(1);
  await page
    .getByRole('region', { name: '즐겨찾기', exact: true })
    .getByRole('button', { name: /상세 보기$/ })
    .click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '링크 삭제', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  oldRelease();
  await expect.poll(() => calls).toBe(2);
  await expect(
    page.getByRole('button', { name: '비서의 추천', exact: true }),
  ).toHaveCount(0);
  freshRelease();
  await expect(
    page.getByText('즐겨찾기한 링크가 없어요.', { exact: true }),
  ).toBeVisible();
});

test('truncated report count equals its unique returned rows and never scans whole link pages', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  product.users.set(testUser.id, model(40));
  await page.goto('/');
  await expect(
    page.getByText('정리가 필요한 링크 20개', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '비서의 추천', exact: true }).click();
  await expect(page.getByTestId('recommendation-candidate')).toHaveCount(20);
  await expect(
    page.getByText('보고서에 포함된 일부 후보예요.', { exact: true }),
  ).toBeVisible();
  const lists = product.requests.filter(
    (request) => new URL(request.url()).pathname === '/links',
  );
  expect(lists).toHaveLength(1);
  expect(new URL(lists[0]!.url()).searchParams.get('favorite')).toBe('true');
  expect(new URL(lists[0]!.url()).searchParams.get('cursor')).toBeNull();
  expect(
    product.requests.filter((request) =>
      request.url().endsWith('/organization-reports'),
    ),
  ).toHaveLength(1);
});
