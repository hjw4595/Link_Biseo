import { expectLayoutWidth } from './layout-assertions';
import { test, expect, authenticate, testUser } from './auth-fixture';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import { parseInBrowser } from './bookmark-browser-helper';
import {
  categoryNameError,
  categoryNameKey,
  emptyMapping,
  folderKey,
  folderGroups,
  mappingPlan,
} from '../src/features/bookmark-import/folder-mapping';
import { buildImportItems } from '../src/features/bookmark-import/utils/detect-import-duplicates';
import type { ParsedBookmark } from '../src/features/bookmark-import/types';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const categoryPattern = /^http:\/\/127\.0\.0\.1:54329\/categories$/;
const linkPattern = /^http:\/\/127\.0\.0\.1:54329\/links(?:\?|$)/;
const startButton = (page: Page) =>
  page.getByRole('button', { name: '선택한 링크 가져오기', exact: true });
const target = (page: Page, ordinal: number) =>
  page.getByLabel(`폴더 ${ordinal} 대상 카테고리`, { exact: true });
const nameInput = (page: Page, ordinal: number) =>
  page.getByLabel(`폴더 ${ordinal} 새 카테고리 이름`, { exact: true });
const link = (id: string, url = `https://folder.example.test/${id}`) =>
  `<DT><A HREF="${url}">${id}</A>`;
const folder = (name: string, body: string) =>
  `<DT><H3>${name}</H3><DL>${body}</DL>`;
const html = (body: string) =>
  `<!DOCTYPE NETSCAPE-Bookmark-file-1><H1>Bookmarks</H1><DL>${body}</DL>`;
const twoFolders = () =>
  html(folder('새 개발', link('a')) + folder('새 참고', link('b')));
async function upload(page: Page, body = twoFolders()) {
  await page.goto('/links/import');
  const input = page.getByLabel('HTML 파일 선택', { exact: true });
  await expect(input).toBeEnabled();
  await input.setInputFiles({
    name: 'folders.html',
    mimeType: 'text/html',
    buffer: Buffer.from(body),
  });
  await expect(startButton(page)).toBeEnabled();
}
async function reserve(page: Page, ordinal: number, name?: string) {
  await target(page, ordinal).selectOption('create');
  if (name !== undefined) await nameInput(page, ordinal).fill(name);
}
async function finished(page: Page) {
  await expect(
    page.getByRole('heading', { name: '가져오기 처리 결과', exact: true }),
  ).toBeVisible({ timeout: 20000 });
}

test('folder IDs retain node identity and segment boundaries; empty folders do not create groups', async ({
  page,
}) => {
  const result = await parseInBrowser(
    page,
    html(
      folder('개발', folder('React', link('a'))) +
        folder('참고', folder('React', link('b'))) +
        folder('개발/React', link('c')) +
        folder('개발', folder('React', link('d'))) +
        folder('빈 폴더', '') +
        link('root'),
    ),
  );
  expect(Array.isArray(result)).toBe(true);
  if (!Array.isArray(result)) throw new Error('Expected parsed array');
  const parsed = result as ParsedBookmark[];
  expect(parsed.map((item) => item.folderPath)).toEqual([
    ['개발', 'React'],
    ['참고', 'React'],
    ['개발/React'],
    ['개발', 'React'],
    [],
  ]);
  expect(new Set(parsed.map(folderKey)).size).toBe(5);
  const items = buildImportItems(parsed);
  const groups = folderGroups(
    items,
    new Set(items.map((item) => item.localId)),
  );
  expect(groups).toHaveLength(5);
  expect(groups.filter((group) => group.repeatedPath)).toHaveLength(2);
  expect(folderKey({ ...parsed[0]!, folderPath: ['a/b', 'c'] })).not.toBe(
    folderKey({ ...parsed[0]!, folderPath: ['a', 'b/c'] }),
  );
});

test('category name DTO boundaries and duplicate mapping validation', () => {
  for (const name of ['', ' \t\n\r\f\v', '\0', 'a'.repeat(101)])
    expect(categoryNameError(name)).not.toBeNull();
  for (const name of [
    '한글',
    '日本語',
    '😀'.repeat(100),
    ' a ',
    '<script>plain</script>',
  ])
    expect(categoryNameError(name)).toBeNull();
  expect(categoryNameKey('  ReAcT\t')).toBe('react');
  const bookmarks: ParsedBookmark[] = [0, 1].map((index) => ({
    localId: String(index),
    sourceIndex: index,
    originalUrl: `https://example.com/${index}`,
    originalTitle: '',
    folderPath: [String(index)],
    folderNodeId: index,
    sourceDates: { addDate: null, lastModified: null, lastVisit: null },
  }));
  const items = buildImportItems(bookmarks);
  const config = emptyMapping();
  config.targets = Object.fromEntries(
    items.map((item) => [folderKey(item), { kind: 'create', name: ' React ' }]),
  );
  expect(mappingPlan(items, new Set(['0', '1']), config, []).valid).toBe(false);
  expect(mappingPlan(items, new Set(['0']), config, []).valid).toBe(true);
  expect(
    mappingPlan(items, new Set(['0']), config, [
      { ...initialProduct().categories[0]!, name: 'react' },
    ]).valid,
  ).toBe(false);
});

test('explicit confirmation creates categories first then exact per-item link DTO; modes have no writes', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await upload(
    page,
    html(folder('개발', link('a')) + folder('자료', link('b')) + link('root')),
  );
  await expect(page.getByLabel('분류 방식', { exact: true })).toHaveValue(
    'folders',
  );
  const existing = initialProduct().categories[0]!;
  await target(page, 1).selectOption(existing.id);
  await reserve(page, 2, '새 자료');
  await page.getByLabel('분류 방식', { exact: true }).selectOption('single');
  await page
    .getByLabel('카테고리 선택', { exact: true })
    .selectOption(existing.id);
  await expect(page.getByLabel('최종 카테고리 매핑')).toContainText(
    existing.name,
  );
  await page.getByLabel('분류 방식', { exact: true }).selectOption('folders');
  await expect(nameInput(page, 2)).toHaveValue('새 자료');
  expect(
    api.requests.filter((request) => request.method() !== 'GET'),
  ).toHaveLength(0);
  await startButton(page).dblclick();
  await finished(page);
  const writes = api.requests.filter((request) => request.method() === 'POST');
  expect(writes.map((request) => new URL(request.url()).pathname)).toEqual([
    '/categories',
    '/links',
    '/links',
    '/links',
  ]);
  expect(writes[0]!.postDataJSON()).toEqual({ name: '새 자료' });
  const createdCategory = api.users
    .get(testUser.id)!
    .categories.find((category) => category.name === '새 자료')!;
  const inputs = writes.slice(1).map((request) => request.postDataJSON());
  expect(inputs).toEqual([
    {
      url: 'https://folder.example.test/a',
      categoryId: existing.id,
      customTitle: 'a',
    },
    {
      url: 'https://folder.example.test/b',
      categoryId: createdCategory.id,
      customTitle: 'b',
    },
    {
      url: 'https://folder.example.test/root',
      categoryId: null,
      customTitle: 'root',
    },
  ]);
  await expect(page.getByLabel('카테고리 준비 결과')).toContainText(
    '새 자료: 생성 성공',
  );
});

test('folder selection respects 50 cap; duplicate-only and empty folders cannot create categories', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await upload(
    page,
    html(
      folder(
        '첫 폴더',
        Array.from({ length: 30 }, (_, i) => link(`a${i}`)).join(''),
      ) +
        folder(
          '둘째',
          Array.from({ length: 30 }, (_, i) => link(`b${i}`)).join(''),
        ) +
        folder('중복만', link('dup', 'https://folder.example.test/a0')) +
        folder('기존만', link('existing', initialProduct().links[0]!.url)) +
        folder('빈 폴더', ''),
    ),
  );
  const groups = page.getByLabel('원본 폴더 그룹').locator(':scope > li');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(1)).toContainText(
    '선택 20개 / 등록 후보 30개 · 미선택 10개',
  );
  await page.getByLabel('폴더 1 전체 선택', { exact: true }).uncheck();
  await page.getByLabel('폴더 2 전체 선택', { exact: true }).check();
  // Partial selection stays indeterminate when the cap prevents all 30.
  await page.getByLabel('폴더 1 전체 선택', { exact: true }).click();
  await expect(groups.nth(0)).toContainText(
    '선택 20개 / 등록 후보 30개 · 미선택 10개',
  );
  await reserve(page, 1);
  await page
    .getByRole('button', { name: '모든 폴더 미분류', exact: true })
    .click();
  await expect(target(page, 1)).toHaveValue('uncategorized');
  expect(
    api.requests.filter((request) => request.method() !== 'GET'),
  ).toHaveLength(0);
});

test('name collisions and invalid names block dispatch, selected-only mapping excludes deselected reservations', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await upload(
    page,
    html(
      folder('개발', folder('React', link('a'))) +
        folder('참고', folder('React', link('b'))),
    ),
  );
  await reserve(page, 1);
  await reserve(page, 2);
  await expect(startButton(page)).toBeDisabled();
  await nameInput(page, 2).fill('다른 React');
  await expect(startButton(page)).toBeEnabled();
  await nameInput(page, 1).fill('a'.repeat(101));
  await expect(startButton(page)).toBeDisabled();
  await nameInput(page, 1).fill(initialProduct().categories[0]!.name);
  await expect(startButton(page)).toBeDisabled();
  await page.getByLabel('폴더 1 전체 선택', { exact: true }).uncheck();
  await expect(startButton(page)).toBeEnabled();
  await startButton(page).click();
  await finished(page);
  const writes = api.requests.filter((request) => request.method() === 'POST');
  expect(writes.map((request) => new URL(request.url()).pathname)).toEqual([
    '/categories',
    '/links',
  ]);
  expect(writes[0]!.postDataJSON()).toEqual({ name: '다른 React' });
});

for (const status of [
  400,
  401,
  403,
  404,
  409,
  429,
  500,
  502,
  503,
  200,
  'invalid',
  'network',
  'timeout',
] as const) {
  test(`category ${status} stops all link dispatch and never retries POST automatically`, async ({
    page,
    context,
  }) => {
    let posts = 0,
      links = 0;
    await context.route(linkPattern, (route) => {
      if (route.request().method() === 'POST') links++;
      return route.fallback();
    });
    await context.route(categoryPattern, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts++;
      if (status === 'network') return route.abort('failed');
      if (status === 'timeout') {
        await new Promise((resolve) => setTimeout(resolve, 11000));
        return route.abort('timedout').catch(() => {});
      }
      return route.fulfill({
        status: typeof status === 'number' ? status : 201,
        headers: cors,
        json:
          status === 200
            ? { ...initialProduct().categories[0]!, name: '새 개발' }
            : {},
      });
    });
    await upload(page);
    await reserve(page, 1);
    await startButton(page).click();
    await finished(page);
    expect(posts).toBe(1);
    expect(links).toBe(0);
    await expect(page.getByLabel('카테고리 준비 결과')).toContainText(
      [400, 401, 403, 404, 409].includes(Number(status))
        ? '생성 실패'
        : '생성 여부 확인 불가',
    );
    await expect(startButton(page)).toHaveCount(0);
  });
}

test('partial category success survives failure; recheck failure cannot enable retry; success is not recreated', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  let count = 0,
    failRead = false;
  await context.route(categoryPattern, (route) => {
    if (route.request().method() === 'GET')
      return failRead
        ? route.fulfill({ status: 500, headers: cors, json: {} })
        : route.fallback();
    if (route.request().method() === 'POST' && ++count === 2)
      return route.fulfill({ status: 500, headers: cors, json: {} });
    return route.fallback();
  });
  await upload(page);
  await reserve(page, 1);
  await reserve(page, 2);
  await startButton(page).click();
  await finished(page);
  expect(count).toBe(2);
  await expect(page.getByLabel('카테고리 준비 결과')).toContainText(
    '새 개발: 생성 성공',
  );
  expect(
    api.requests.filter(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/links',
    ),
  ).toHaveLength(0);
  failRead = true;
  await page
    .getByRole('button', { name: '저장 여부 다시 확인', exact: true })
    .click();
  await expect(
    page.getByText('카테고리 목록을 다시 확인하지 못해 재시도할 수 없어요.'),
  ).toBeVisible();
  await expect(startButton(page)).toHaveCount(0);
  failRead = false;
  await page
    .getByRole('button', { name: '저장 여부 다시 확인', exact: true })
    .click();
  await page.getByLabel('폴더 1 전체 선택', { exact: true }).check();
  await page.getByLabel('폴더 2 전체 선택', { exact: true }).check();
  await expect(startButton(page)).toBeDisabled();
  const saved = api.users
    .get(testUser.id)!
    .categories.find((category) => category.name === '새 개발')!;
  await expect(target(page, 1)).toHaveValue(saved.id);
  await target(page, 2).selectOption(initialProduct().categories[0]!.id);
  await startButton(page).click();
  await finished(page);
  expect(count).toBe(2);
  expect(
    api.requests.filter((request) => request.method() === 'DELETE'),
  ).toHaveLength(0);
  expect(
    api.requests.filter(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/links',
    ),
  ).toHaveLength(2);
});

test('lost category response remains unknown after name match until explicit existing selection', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  let count = 0;
  const saved = {
    ...initialProduct().categories[0]!,
    id: fixtureId('990'),
    name: '새 개발',
  };
  await context.route(categoryPattern, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    count++;
    api.users.get(testUser.id)!.categories.push(saved);
    return route.abort('failed');
  });
  await upload(page);
  await reserve(page, 1);
  await startButton(page).click();
  await finished(page);
  await page
    .getByRole('button', { name: '저장 여부 다시 확인', exact: true })
    .click();
  await page.getByLabel('폴더 1 전체 선택', { exact: true }).check();
  await expect(startButton(page)).toBeDisabled();
  await expect(page.getByLabel('카테고리 준비 결과')).toContainText(
    '생성 여부 확인 불가',
  );
  await target(page, 1).selectOption(saved.id);
  await startButton(page).click();
  await finished(page);
  expect(count).toBe(1);
  const writes = api.requests.filter(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/links',
  );
  expect(writes).toHaveLength(1);
  expect(writes[0]!.postDataJSON().categoryId).toBe(saved.id);
});

for (const action of ['stop', 'account', 'back', 'reload'] as const) {
  test(`category preparation ${action} freezes mapping and prevents later writes`, async ({
    page,
    context,
  }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let posts = 0,
      links = 0;
    await context.route(linkPattern, (route) => {
      if (route.request().method() === 'POST') links++;
      return route.fallback();
    });
    await context.route(categoryPattern, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts++;
      await gate;
      return route
        .fulfill({
          status: 201,
          headers: cors,
          json: {
            ...initialProduct().categories[0]!,
            id: fixtureId('991'),
            name: '새 개발',
          },
        })
        .catch(() => {});
    });
    await page.goto('/links');
    await upload(page);
    await reserve(page, 1);
    await reserve(page, 2);
    await startButton(page).click();
    await expect(
      page.getByRole('heading', { name: '카테고리 준비 중', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('분류 방식', { exact: true })).toHaveCount(0);
    if (action === 'stop')
      await page
        .getByRole('button', { name: '새 요청 중단', exact: true })
        .click();
    else if (action === 'account') {
      await authenticate(context, false, 'alternate');
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(
        page.getByLabel('HTML 파일 선택', { exact: true }),
      ).toBeEnabled();
    } else {
      page.on('dialog', (dialog) => dialog.accept());
      if (action === 'back') await page.goBack();
      else await page.reload();
    }
    release();
    if (action === 'stop') {
      await finished(page);
      await expect(page.getByLabel('카테고리 준비 결과')).toContainText(
        '생성 성공',
      );
    } else await expect(page.getByLabel('카테고리 준비 결과')).toHaveCount(0);
    expect(posts).toBe(1);
    expect(links).toBe(0);
  });
}

for (const width of [320, 390, 512, 1440])
  test(`folder mapping layout keyboard and plain text at ${width}px`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    await page.setViewportSize({ width, height: 900 });
    await upload(
      page,
      html(
        folder('길고 긴 원본 폴더 이름'.repeat(8), link('a')) +
          folder('참고', link('b')),
      ),
    );
    await reserve(page, 1, '<img src="https://attacker.test/x">');
    await expect(page.getByLabel('최종 카테고리 매핑')).toContainText('<img');
    await expect(page.locator('img[src*="attacker"]')).toHaveCount(0);
    await target(page, 2).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(nameInput(page, 2)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expectLayoutWidth(page);
    expect(
      api.requests.filter((request) => request.method() !== 'GET'),
    ).toHaveLength(0);
    mkdirSync('artifacts/wo-011-d', { recursive: true });
    await page.screenshot({
      path: `artifacts/wo-011-d/mapping-${width}.png`,
      fullPage: true,
    });
  });
