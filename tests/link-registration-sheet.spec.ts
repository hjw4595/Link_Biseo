import { installOrganizationApi } from './organization-fixture';
import { presetApi } from './quick-launch-fixture';
import { test, expect, testUser } from './auth-fixture';
import {
  fixtureId,
  initialProduct,
  installProductApi,
} from './product-fixture';
import { mkdir } from 'node:fs/promises';
const root = 'artifacts/link-registration-sheet';
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
const category = fixtureId('ai');
const submit = { name: '링크 등록', exact: true } as const;
for (const width of [320, 390, 512, 768, 1024, 1440, 1920])
  test(`registration uses common right Sheet at ${width}`, async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/links?categoryId=${category}&sort=recent`);
    await expect(page.getByTestId('link-item')).toHaveCount(4);
    const before = page.url();
    const list = await page
      .getByLabel('저장한 링크 목록', { exact: true })
      .elementHandle();
    const trigger = page.getByRole('link', submit).first();
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: '링크 등록', exact: true });
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(before);
    await expect(page.locator('#link-url')).toBeFocused();
    await expect(page.locator('#category')).toHaveValue(category);
    expect(await list?.evaluate((node) => node.isConnected)).toBe(true);
    const bounds = await sheet.boundingBox();
    expect(bounds!.width).toBe(width < 1024 ? width : 512);
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return box!.x + box!.width;
      })
      .toBeCloseTo(width, 0);
    expect(bounds!.height).toBe(900);
    await page.locator('#link-url').fill('https://example.test/right-sheet');
    await page.locator('#custom-title').fill('우측 등록');
    await page
      .getByRole('button', { name: '+ 설명 추가', exact: true })
      .click();
    await page.locator('#note').fill('기존 입력 기능 유지');
    const dir = `${root}/${browserName}`;
    await mkdir(dir, { recursive: true });
    await page.screenshot({
      path: `${dir}/registration-${width}.png`,
      animations: 'disabled',
    });
    await page.setViewportSize({ width, height: 480 });
    await page.locator('#note').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', submit)).toBeInViewport();
    await expect(
      page.getByRole('button', { name: '취소', exact: true }),
    ).toBeInViewport();
    expect(
      await page
        .locator('[data-slot=app-sheet-body]')
        .evaluate((node) => node.scrollHeight > node.clientHeight),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: '버리고 나가기', exact: true })
      .click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(before);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(page.locator('#link-url')).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
  });
test('X, Escape, overlay and footer cancel share discard policy and preserve draft on cancellation', async ({
  page,
}) => {
  await page.goto('/links');
  const trigger = page.getByRole('link', submit).first();
  await trigger.click();
  await page.locator('#link-url').fill('https://example.test/draft');
  for (const kind of ['close', 'escape', 'overlay', 'cancel']) {
    if (kind === 'close')
      await page.getByRole('button', { name: '닫기', exact: true }).click();
    else if (kind === 'escape') await page.keyboard.press('Escape');
    else if (kind === 'overlay')
      await page
        .locator('[data-slot=sheet-overlay]')
        .click({ position: { x: 10, y: 200 }, force: true });
    else
      await page
        .getByRole('dialog', { name: '링크 등록', exact: true })
        .getByRole('button', { name: '취소', exact: true })
        .click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: '취소', exact: true })
      .click();
    await expect(page.locator('#link-url')).toHaveValue(
      'https://example.test/draft',
    );
    await expect(
      page.getByRole('dialog', { name: '링크 등록', exact: true }),
    ).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(
    page.getByRole('dialog', { name: '링크 등록', exact: true }),
  ).toBeVisible();
});
test('pending save locks all close actions, failed save keeps draft, retry is single and returns to server category', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route('http://127.0.0.1:54329/links', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    posts++;
    if (posts === 1) {
      await gate;
      return route.fulfill({
        status: 503,
        headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
        json: {},
      });
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto(`/links?categoryId=${category}`);
  await page.getByRole('link', submit).first().click();
  await page.locator('#link-url').fill('https://example.test/created-sheet');
  await page.locator('#custom-title').fill('시트 등록 성공');
  await page.locator('#category').selectOption('');
  await page.getByRole('button', submit).click();
  await expect(
    page.getByRole('button', { name: '닫기', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '취소', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(posts).toBe(1);
  release();
  await expect(
    page
      .getByRole('dialog', { name: '링크 등록', exact: true })
      .getByRole('alert'),
  ).toHaveText('처리하지 못했어요. 다시 시도해 주세요.');
  await expect(
    page
      .getByRole('dialog', { name: '링크 등록', exact: true })
      .getByRole('alert'),
  ).toBeInViewport();
  await expect(page.getByRole('button', submit)).toBeInViewport();
  await expect(page.locator('#custom-title')).toHaveValue('시트 등록 성공');
  await page.getByRole('button', submit).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('/links?categoryId=uncategorized');
  await expect(
    page.getByRole('link', { name: '시트 등록 성공 열기', exact: true }),
  ).toBeVisible();
  expect(posts).toBe(2);
  expect(
    api.users
      .get(testUser.id)!
      .links.some((row) => row.title === '시트 등록 성공'),
  ).toBe(true);
});
test('Home, legacy category, quick-launch empty and organization empty entries open one registration Sheet', async ({
  page,
  context,
}) => {
  const api = await installOrganizationApi(context);
  const state = initialProduct();
  state.links = [];
  api.users.set(testUser.id, state);
  await presetApi(page, 0);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of [
    '/',
    `/category/${category}`,
    '/assistant/organization',
  ]) {
    await page.goto(path);
    if (path === '/assistant/organization')
      await page
        .getByRole('button', { name: '추천 확인하기', exact: true })
        .click();
    const entry = page
      .getByRole('link', { name: path === '/' ? '링크 추가하기' : /링크 추가/ })
      .first();
    await entry.click();
    await expect(
      page.getByRole('dialog', { name: '링크 등록', exact: true }),
    ).toHaveCount(1);
    await expect(page).toHaveURL(path);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(entry).toBeFocused();
  }
});
test('direct URL is the same Sheet; clean browser navigation closes local registration; keyboard entry works', async ({
  page,
}) => {
  await page.goto(`/links/new?categoryId=${category}&from=links`);
  await expect(
    page.getByRole('dialog', { name: '링크 등록', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#category')).toHaveValue(category);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page).toHaveURL(`/links?categoryId=${category}`);
  await page.goto('/');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  const trigger = page.getByRole('link', submit).first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('modified registration click keeps native new-tab navigation and direct Sheet fallback', async ({
  page,
  context,
}) => {
  await page.goto('/links');
  const trigger = page
    .getByRole('link', { name: '링크 등록', exact: true })
    .first();
  await trigger.focus();
  const popup = context.waitForEvent('page');
  await trigger.click({ modifiers: ['Control'] });
  const opened = await popup;
  await expect(opened).toHaveURL('/links/new');
  await expect(
    opened.getByRole('dialog', { name: '링크 등록', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL('/links');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await opened.close();
});
