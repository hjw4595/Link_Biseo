import { mkdir } from 'node:fs/promises';
import { test, expect, testUser } from './auth-fixture';
import {
  fixtureId,
  initialProduct,
  installProductApi,
} from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import { editLinkInfo, requestLinkDeletion } from './link-actions-helper';

const id = fixtureId('chatgpt');
const api = 'http://127.0.0.1:54329';
const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const root = 'artifacts/wo-ui-10/after';
async function openSheet(page: import('@playwright/test').Page) {
  await page.goto('/links');
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
}
test.beforeEach(async () => {
  await mkdir(root, { recursive: true });
});

for (const path of [
  '/',
  '/links',
  `/category/${fixtureId('ai')}`,
  '/links?q=ChatGPT',
]) {
  test(`independent info, favorite and detail actions on ${path}`, async ({
    page,
    context,
  }) => {
    const fixture = await installProductApi(context);
    await page.setViewportSize({ width: 390, height: 900 });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`${api}/links/${id}`, async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      await gate;
      return route.fulfill({ headers, status: 503, json: {} });
    });
    await page.goto(path);
    const row = page.getByTestId('link-item').filter({
      has: page.getByRole('button', { name: 'ChatGPT 상세 보기', exact: true }),
    });
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: /더보기/ })).toHaveCount(0);
    const info = row.getByRole('link', { name: 'ChatGPT 열기', exact: true });
    const star = row.getByRole('button', {
      name: 'ChatGPT 즐겨찾기',
      exact: true,
    });
    const detail = row.getByRole('button', {
      name: 'ChatGPT 상세 보기',
      exact: true,
    });
    await info.focus();
    await page.keyboard.press('Tab');
    await expect(star).toBeFocused();
    await page.keyboard.press('Space');
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    expect(context.pages()).toHaveLength(1);
    expect(
      fixture.requests.filter((r) => r.url().endsWith('/open')),
    ).toHaveLength(0);
    release();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    if (path === '/links')
      await page.screenshot({
        path: `${root}/favorite-390.png`,
        animations: 'disabled',
      });
    await star.focus();
    await page.keyboard.press('Tab');
    await expect(detail).toBeFocused();
    if (path === '/links')
      await page.screenshot({
        path: `${root}/detail-action-390.png`,
        animations: 'disabled',
      });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(path);
    expect(
      fixture.requests.filter((r) => r.url().endsWith('/open')),
    ).toHaveLength(0);
    await expect(
      page.getByRole('heading', { name: '사용 빈도' }),
    ).toBeVisible();
  });
}

for (const width of [320, 390, 512, 768, 1024, 1440, 1920]) {
  test(`detail inline edit geometry, save fields and description ${width}`, async ({
    page,
    context,
  }) => {
    const fixture = await installProductApi(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/links');
    await page
      .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({
      path: `${root}/view-${width}.png`,
      animations: 'disabled',
    });
    await editLinkInfo(page);
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByLabel('제목', { exact: true })).toBeFocused();
    await expect(
      sheet.getByRole('button', { name: '변경 저장', exact: true }),
    ).toBeDisabled();
    await expect(sheet.getByLabel('설명', { exact: true })).toBeVisible();
    await expect(sheet.locator('input[type=url]')).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: /즐겨찾기/ })).toHaveCount(
      0,
    );
    await expect
      .poll(async () => Math.round((await sheet.boundingBox())?.width ?? 0))
      .toBe(width < 1024 ? width : 512);
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return Math.round((box?.x ?? 0) + (box?.width ?? 0));
      })
      .toBe(width);
    await sheet.getByLabel('제목', { exact: true }).fill(`정보 수정 ${width}`);
    await sheet.getByLabel('카테고리', { exact: true }).selectOption('');

    await sheet.getByLabel('설명', { exact: true }).fill('수정한 개인 설명');

    await page.screenshot({
      path: `${root}/fields-edit-${width}.png`,
      animations: 'disabled',
    });
    await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(sheet.getByLabel('제목', { exact: true })).toHaveCount(0);
    await expect(sheet).toBeVisible();
    await expect(
      page.getByRole('button', { name: '정보 수정', exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole('heading', { name: `정보 수정 ${width}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('수정한 개인 설명', { exact: true }),
    ).toBeVisible();
    const writes = fixture.requests.filter(
      (r) =>
        r.method() === 'PATCH' && new URL(r.url()).pathname === `/links/${id}`,
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]?.postDataJSON()).toEqual({
      customTitle: `정보 수정 ${width}`,
      categoryId: null,
      customDescription: '수정한 개인 설명',
    });
    expect(
      fixture.users.get(testUser.id)?.links.find((l) => l.id === id)
        ?.isFavorite,
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}

for (const close of ['x', 'escape', 'overlay', 'cancel']) {
  test(`edit discard confirmation and focus: ${close}`, async ({
    page,
    context,
  }) => {
    const fixture = await installProductApi(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSheet(page);
    await editLinkInfo(page);
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('제목', { exact: true }).fill('유지할 초안');
    const request = async () => {
      if (close === 'x')
        await sheet.getByRole('button', { name: '닫기', exact: true }).click();
      else if (close === 'cancel')
        await sheet.getByRole('button', { name: '취소', exact: true }).click();
      else if (close === 'escape') await page.keyboard.press('Escape');
      else await page.mouse.click(5, 5);
    };
    await request();
    const dialog = page.getByRole('alertdialog');
    await expect(
      dialog.getByRole('button', { name: '계속 편집', exact: true }),
    ).toBeFocused();
    await page.screenshot({
      path: `${root}/discard-${close}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(sheet.getByLabel('제목', { exact: true })).toHaveValue(
      '유지할 초안',
    );
    await expect
      .poll(() =>
        sheet.evaluate((node) => node.contains(document.activeElement)),
      )
      .toBe(true);
    await request();
    await dialog
      .getByRole('button', { name: '변경 사항 버리기', exact: true })
      .click();
    if (close === 'cancel') {
      await expect(sheet).toBeVisible();
      await expect(
        sheet.getByRole('button', { name: '정보 수정', exact: true }),
      ).toBeFocused();
    } else await expect(sheet).toHaveCount(0);
    expect(fixture.requests.filter((r) => r.method() === 'PATCH')).toHaveLength(
      0,
    );
  });
}

test('pending PATCH blocks close and retries with draft intact; unchanged editing never PATCHes', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let patches = 0;
  await page.route(`${api}/links/${id}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    patches++;
    if (patches === 1) {
      await gate;
      return route.fulfill({ headers, status: 503, json: {} });
    }
    return route.fallback();
  });
  await openSheet(page);
  await editLinkInfo(page);
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: '취소', exact: true }).click();
  expect(patches).toBe(0);
  await editLinkInfo(page);
  await sheet.getByLabel('제목', { exact: true }).fill('실패 후 유지');
  await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(
    sheet.getByRole('button', { name: '닫기', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeVisible();
  release();
  await expect(sheet.getByRole('alert')).toBeVisible();
  await expect(sheet.getByLabel('제목', { exact: true })).toHaveValue(
    '실패 후 유지',
  );
  await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(sheet.getByLabel('제목', { exact: true })).toHaveCount(0);
  await expect(sheet).toBeVisible();
  expect(patches).toBe(2);
  expect(
    fixture.requests.filter((r) => r.url().endsWith('/open')),
  ).toHaveLength(0);
});

test('URL copy and failure guidance keep plain URL selectable', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/links/${id}`);
  await page.getByRole('button', { name: 'URL 복사', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'URL을 복사했어요.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'https://chatgpt.com/',
  );
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
  });
  await page.getByRole('button', { name: 'URL 복사', exact: true }).click();
  await expect(page.getByText(/직접 선택해 복사/)).toBeVisible();
});

test('background detail response cannot reset the open editor snapshot', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  await openSheet(page);
  await expect(
    page.getByRole('heading', { name: 'ChatGPT', exact: true }),
  ).toBeVisible();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let refreshing = false;
  await page.route(`${api}/links/${id}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    refreshing = true;
    await gate;
    const link = fixture.users
      .get(testUser.id)
      ?.links.find((link) => link.id === id);
    return route.fulfill({
      headers,
      json: { ...link, title: '늦게 도착한 서버 제목' },
    });
  });
  await page
    .getByRole('button', { name: '정보 새로고침', exact: true })
    .click();
  await expect.poll(() => refreshing).toBe(true);
  await editLinkInfo(page);
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('제목', { exact: true }).fill('사용자가 작성한 초안');
  const incoming = page.waitForResponse(
    (response) =>
      response.url() === `${api}/links/${id}` &&
      response.request().method() === 'GET',
  );
  release();
  await (await incoming).finished();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(sheet.getByLabel('제목', { exact: true })).toHaveValue(
    '사용자가 작성한 초안',
  );
  await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(sheet.getByLabel('제목', { exact: true })).toHaveCount(0);
  await expect(sheet).toBeVisible();
  expect(
    fixture.requests
      .find((request) => request.method() === 'PATCH')
      ?.postDataJSON(),
  ).toEqual({ customTitle: '사용자가 작성한 초안' });
});

test('description add/clear sends only the changed nullable field', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  fixture.users.set(testUser.id, initialProduct());
  const link = fixture.users
    .get(testUser.id)
    ?.links.find((link) => link.id === id);
  if (!link) throw new Error('Missing fixture');
  link.description = null;
  await openSheet(page);
  await editLinkInfo(page);
  const sheet = page.getByRole('dialog');

  await sheet.getByLabel('설명', { exact: true }).fill('새 설명');
  await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(sheet.getByLabel('제목', { exact: true })).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await editLinkInfo(page);

  await sheet.getByLabel('설명', { exact: true }).fill('');
  await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(sheet.getByLabel('제목', { exact: true })).toHaveCount(0);
  await expect(sheet).toBeVisible();
  expect(
    fixture.requests
      .filter((request) => request.method() === 'PATCH')
      .map((request) => request.postDataJSON()),
  ).toEqual([{ customDescription: '새 설명' }, { customDescription: null }]);
});

for (const status of [403, 404]) {
  test(`inaccessible detail ${status} exposes no link management or private data`, async ({
    page,
  }) => {
    await page.route(`${api}/links/${id}`, (route) =>
      route.fulfill({ headers, status, json: {} }),
    );
    await page.goto(`/links/${id}`);
    if (status === 404)
      await expect(
        page.getByText('링크를 찾을 수 없어요', { exact: true }),
      ).toBeVisible();
    else await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'ChatGPT', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '링크 관리', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'URL 복사', exact: true }),
    ).toHaveCount(0);
  });
}

test('delete cancel, failure, retry and preset membership invalidation preserve unrelated links', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await installProductApi(context);
  const presets = await presetApi(page, 1, 2);
  let fail = true,
    deletes = 0;
  await page.route(`${api}/links/${id}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    deletes++;
    if (fail) return route.fulfill({ headers, status: 503, json: {} });
    // Model the existing backend FK cascade; no frontend membership write is sent.
    presets.items = presets.items.map((p) => ({
      ...p,
      links: p.links.filter((row) => row.link.id !== id),
      linkCount: p.links.filter((row) => row.link.id !== id).length,
    }));
    return route.fallback();
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await requestLinkDeletion(page);
  const dialog = page.getByRole('alertdialog');
  await page.screenshot({
    path: `${root}/delete-1440.png`,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: `${root}/delete-390.png`,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '삭제', exact: true }),
  ).toBeFocused();
  expect(deletes).toBe(0);
  await requestLinkDeletion(page);
  await dialog.getByRole('button', { name: '링크 삭제', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(presets.items[0]?.linkCount).toBe(2);
  fail = false;
  await dialog.getByRole('button', { name: '링크 삭제', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(deletes).toBe(2);
  expect(fixture.users.get(testUser.id)?.links).toHaveLength(7);
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  await expect(
    page.getByRole('list', { name: '업무 1 포함 링크' }).getByRole('link'),
  ).toHaveCount(1);
  expect(presets.requests.filter((r) => r.method !== 'GET')).toHaveLength(0);
  await page.goto(`/links/${id}`);
  await expect(
    page.getByText('링크를 찾을 수 없어요', { exact: true }),
  ).toBeVisible();
});
