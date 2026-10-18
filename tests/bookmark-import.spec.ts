import { openBookmarkImport } from './link-filter-helper';
import { expectLayoutWidth } from './layout-assertions';
import { test, expect, authenticate, testUser } from './auth-fixture';
import {
  installProductApi,
  initialProduct,
  fixtureId,
} from './product-fixture';
import { bookmarkFixture, bookmarkHtml } from './bookmark-browser-helper';
import type { Page } from '@playwright/test';

const apiPattern = /^http:\/\/127\.0\.0\.1:54329\/links(?:\?|$)/;
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
test('analysis proceeds even when the browser withholds animation frames', async ({
  page,
}) => {
  await page.goto('/links/import');
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
  });
  await upload(page, bookmarkHtml(1));
  await complete(page);
  await expect(
    page.getByRole('list', { name: '북마크 항목' }).getByRole('checkbox'),
  ).toBeChecked();
});
async function upload(page: Page, html: string, name = 'bookmarks.html') {
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel('HTML 파일 선택', { exact: true })
    .setInputFiles({ name, mimeType: 'text/html', buffer: Buffer.from(html) });
}
async function complete(page: Page) {
  await expect(
    page.getByRole('status').filter({ hasText: /기존 링크 \d+개 확인 완료/ }),
  ).toBeVisible();
}
test('saved entry, three export formats, duplicates/category/hash and zero writes', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  await page.goto('/links');
  await openBookmarkImport(page);
  await expect(page).toHaveURL('/links/import');
  fixture.requests.length = 0;
  for (const name of ['chrome.html', 'edge.html', 'firefox.html']) {
    await upload(page, bookmarkFixture(name), name);
    await complete(page);
    await expect(
      page.getByText('개발 미리보기:', { exact: false }),
    ).toBeVisible();
  }
  await upload(
    page,
    '<H1>Bookmarks</H1><DL><DT><A HREF="https://fresh.example.test/a#one">첫째</A><DT><H3>다른 폴더</H3><DL><DT><A HREF="https://fresh.example.test/a#two">중복</A></DL><DT><A HREF="javascript:alert(1)">무효</A><DT><A HREF="https://[2001:db8::1]/">미검증</A></DL>',
  );
  await complete(page);
  const rows = page
    .getByRole('list', { name: '북마크 항목' })
    .locator(':scope > li');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0).getByRole('checkbox')).toBeChecked();
  for (const index of [1, 2, 3])
    await expect(rows.nth(index).getByRole('checkbox')).toBeDisabled();
  await expect(rows.nth(1)).toContainText('파일 내부 중복');
  await expect(rows.nth(3)).toContainText('비교 미검증');
  await expect(rows.nth(0)).toContainText('# 뒤 위치 정보');
  await rows.nth(0).getByText('원본 URL 보기', { exact: true }).click();
  await expect(rows.nth(0)).toContainText('https://fresh.example.test/a#one');
  const category = initialProduct().categories[0];
  if (!category) throw new Error('Missing category');
  await page.getByLabel('분류 방식', { exact: true }).selectOption('single');
  await page
    .getByLabel('카테고리 선택', { exact: true })
    .selectOption(category.id);
  await expect(page.getByLabel('카테고리 선택', { exact: true })).toHaveValue(
    category.id,
  );
  await page.getByLabel('카테고리 선택', { exact: true }).selectOption('');
  expect(
    fixture.requests.filter((request) => request.method() !== 'GET'),
  ).toEqual([]);
  expect(
    fixture.requests
      .filter((request) => new URL(request.url()).pathname === '/links')
      .every((request) => {
        const query = new URL(request.url()).searchParams;
        return (
          query.get('sort') === 'default' &&
          query.get('limit') === '100' &&
          !query.has('favorite') &&
          !query.has('categoryId')
        );
      }),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: /가져오기 시작|저장하기/ }),
  ).toHaveCount(0);
});
test('existing duplicate in a later cursor page, maximum 50 selections and 25 DOM rows', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  const state = initialProduct();
  const base = state.links[0];
  if (!base) throw new Error('Missing link');
  state.links = Array.from({ length: 101 }, (_, i) => ({
    ...base,
    id: fixtureId(`scan-${i}`),
    url: `https://saved.example.test/${i}`,
  }));
  fixture.users.set(testUser.id, state);
  await page.goto('/links/import');
  const html = bookmarkHtml(60).replace(
    '</DL>',
    '<DT><A HREF="https://saved.example.test/100#hash">既存リンク</A></DL>',
  );
  await upload(page, html);
  await complete(page);
  const rows = page
    .getByRole('list', { name: '북마크 항목' })
    .locator(':scope > li');
  await expect(rows).toHaveCount(25);
  await expect(
    page.getByText('선택 50개 / 최대 50개.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: '다음 25개' }).click();
  await page.getByRole('button', { name: '다음 25개' }).click();
  await expect(rows).toHaveCount(11);
  await expect(rows.nth(0).getByRole('checkbox')).toBeDisabled();
  await expect(rows.nth(10)).toContainText('기존 링크 중복');
  await expect(rows.nth(10).getByRole('checkbox')).toBeDisabled();
  await page.getByRole('button', { name: '선택 해제', exact: true }).click();
  await rows.nth(0).getByRole('checkbox').check();
  await expect(
    page.getByText('선택 1개 / 최대 50개.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: '앞에서 50개 선택' }).click();
  await expect(
    page.getByText('선택 50개 / 최대 50개.', { exact: false }),
  ).toBeVisible();
  expect(
    fixture.requests.filter((request) => request.method() === 'POST'),
  ).toEqual([]);
  expect(
    fixture.requests.filter(
      (request) => new URL(request.url()).pathname === '/links',
    ),
  ).toHaveLength(2);
});
test('failed and repeated cursor scans remain incomplete, unselectable, and can recheck', async ({
  page,
  context,
}) => {
  const base = initialProduct().links[0];
  if (!base) throw new Error('Missing fixture');
  let mode: 'fail' | 'repeat' | 'ok' = 'fail';
  await context.route(apiPattern, (route) =>
    route.fulfill({
      headers: cors,
      status: mode === 'fail' ? 500 : 200,
      json:
        mode === 'fail'
          ? {}
          : {
              items: [base],
              nextCursor: mode === 'repeat' ? 'same.cursor' : null,
            },
    }),
  );
  await page.goto('/links/import');
  await upload(page, bookmarkHtml(1));
  await expect(page.locator('#main-content').getByRole('alert')).toContainText(
    '기존 링크 확인 미완료',
  );
  await expect(
    page.getByRole('list', { name: '북마크 항목' }).getByRole('checkbox'),
  ).toBeDisabled();
  await expect(
    page.getByRole('option', { name: '신규 후보', exact: true }),
  ).toHaveCount(0);
  mode = 'repeat';
  await page.getByRole('button', { name: '기존 링크 다시 확인' }).click();
  await expect(page.locator('#main-content').getByRole('alert')).toContainText(
    '다음 페이지',
  );
  mode = 'ok';
  await page.getByRole('button', { name: '기존 링크 다시 확인' }).click();
  await complete(page);
  await expect(
    page.getByRole('list', { name: '북마크 항목' }).getByRole('checkbox'),
  ).toBeChecked();
});
test('file replacement discards a slow file read and an old in-flight scan', async ({
  page,
  context,
}) => {
  await page.goto('/links/import');
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      if (this.name === 'slow.html')
        await new Promise((resolve) => setTimeout(resolve, 500));
      return original.call(this);
    };
  });
  await upload(page, bookmarkHtml(5), 'slow.html');
  await upload(
    page,
    bookmarkHtml(1).replace('링크 0', '최신 파일'),
    'new.html',
  );
  await complete(page);
  await page.waitForTimeout(550);
  await expect(
    page.getByRole('list', { name: '북마크 항목' }).locator(':scope > li'),
  ).toHaveCount(1);
  await expect(page.getByRole('list', { name: '북마크 항목' })).toContainText(
    '최신 파일',
  );
  let first = true;
  let started = false;
  await context.route(apiPattern, async (route) => {
    if (first) {
      first = false;
      started = true;
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
    await route
      .fulfill({ headers: cors, json: { items: [], nextCursor: null } })
      .catch(() => {});
  });
  await upload(page, bookmarkHtml(5), 'old-scan.html');
  await expect.poll(() => started).toBe(true);
  await upload(page, bookmarkHtml(2), 'new-scan.html');
  await complete(page);
  await page.waitForTimeout(500);
  await expect(
    page.getByRole('list', { name: '북마크 항목' }).locator(':scope > li'),
  ).toHaveCount(2);
});
test('account A/B isolation clears file, selection and category', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  await page.goto('/links/import');
  await upload(page, bookmarkHtml(1).replace('링크 0', 'A 비공개 제목'));
  await complete(page);
  const category = initialProduct().categories[0];
  if (!category) throw new Error('Missing category');
  await page.getByLabel('분류 방식', { exact: true }).selectOption('single');
  await page
    .getByLabel('카테고리 선택', { exact: true })
    .selectOption(category.id);
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('A 비공개 제목', { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeVisible();
  await upload(page, bookmarkHtml(2).replace('링크 0', 'B 파일'));
  await complete(page);
  await expect(page.getByLabel('분류 방식', { exact: true })).toHaveValue(
    'folders',
  );
  await page.getByLabel('분류 방식', { exact: true }).selectOption('single');
  await expect(page.getByLabel('카테고리 선택', { exact: true })).toHaveValue(
    '',
  );
  await expect(
    page.getByRole('list', { name: '북마크 항목' }).locator(':scope > li'),
  ).toHaveCount(2);
  const users = fixture.requests
    .filter((request) => new URL(request.url()).pathname === '/links')
    .map((request) => {
      const token = request.headers().authorization?.split('.')[1];
      if (!token) throw new Error('Missing token');
      const claims: unknown = JSON.parse(
        Buffer.from(token, 'base64url').toString(),
      );
      return typeof claims === 'object' && claims !== null && 'sub' in claims
        ? claims.sub
        : null;
    });
  expect(users).toContain(testUser.id);
  expect(users).toContain('22222222-2222-4222-8222-222222222222');
  expect(
    fixture.requests.filter((request) => request.method() === 'POST'),
  ).toEqual([]);
});
test('an account switch during a pending scan cannot expose A results or dispatch its next page', async ({
  page,
  context,
}) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await context.route(apiPattern, async (route) => {
    calls++;
    if (calls === 1) {
      await pending;
      const base = initialProduct().links[0];
      if (!base) throw new Error('Missing fixture');
      await route
        .fulfill({
          headers: cors,
          json: { items: [base], nextCursor: 'A.next' },
        })
        .catch(() => {});
    } else
      await route.fulfill({
        headers: cors,
        json: { items: [], nextCursor: null },
      });
  });
  await page.goto('/links/import');
  await upload(page, bookmarkHtml(1).replace('링크 0', 'A 진행중'), 'A.html');
  await expect.poll(() => calls).toBe(1);
  await expect(
    page.getByRole('list', { name: '북마크 항목' }).getByRole('checkbox'),
  ).toBeDisabled();
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('선택한 파일: A.html')).toHaveCount(0);
  await upload(page, bookmarkHtml(1).replace('링크 0', 'B 결과'), 'B.html');
  await complete(page);
  release();
  await page.waitForTimeout(150);
  await expect(page.getByRole('list', { name: '북마크 항목' })).toContainText(
    'B 결과',
  );
  await expect(page.getByText('A 진행중', { exact: true })).toHaveCount(0);
  expect(calls).toBe(2);
  expect(
    await page.evaluate(() =>
      [...Object.values(localStorage), ...Object.values(sessionStorage)].some(
        (value) => value.includes('import.example.test'),
      ),
    ),
  ).toBe(false);
});
test('file errors, exact byte limit, invalid encoding, zero valid links and category retry', async ({
  page,
  context,
}) => {
  await page.goto('/links/import');
  await upload(page, '', 'empty.html');
  await expect(page.locator('#main-content').getByRole('alert')).toContainText(
    '빈 파일',
  );
  await upload(page, bookmarkHtml(1), 'wrong.txt');
  await expect(page.locator('#main-content').getByRole('alert')).toContainText(
    'HTML(.html',
  );
  await upload(page, 'x'.repeat(1024 * 1024 + 1));
  await expect(page.locator('#main-content').getByRole('alert')).toContainText(
    '분석 제한',
  );
  const exact = bookmarkHtml(1);
  await upload(
    page,
    exact + ' '.repeat(1024 * 1024 - Buffer.byteLength(exact)),
  );
  await complete(page);
  await page.getByLabel('HTML 파일 선택', { exact: true }).setInputFiles({
    name: 'bad.html',
    mimeType: '',
    buffer: Buffer.from([0xff, 0xfe, 0xfd]),
  });
  await expect(page.locator('#main-content').getByRole('alert')).toContainText(
    'UTF-8',
  );
  await upload(
    page,
    bookmarkHtml(1).replace('https://import.example.test/0', 'file:///private'),
  );
  await complete(page);
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: '가져올 수 있는 링크가 없어요' }),
  ).toBeVisible();
  await context.route('**/categories', (route) =>
    route.fulfill({ headers: cors, status: 500, json: {} }),
  );
  await page.reload();
  await upload(page, bookmarkHtml(1));
  await expect(page.getByLabel('분류 방식', { exact: true })).toBeDisabled();
  await context.unroute('**/categories');
  await page.getByRole('button', { name: '카테고리 다시 확인' }).click();
  await expect(page.getByLabel('분류 방식', { exact: true })).toBeEnabled();
  await page.getByLabel('분류 방식', { exact: true }).selectOption('single');
  await expect(page.getByLabel('카테고리 선택', { exact: true })).toBeEnabled();
});
test('read failure clears the previous preview and a file with an empty MIME still validates its contents', async ({
  page,
}) => {
  await page.goto('/links/import');
  await expect(
    page.getByLabel('HTML 파일 선택', { exact: true }),
  ).toBeEnabled();
  await page.getByLabel('HTML 파일 선택', { exact: true }).setInputFiles({
    name: 'empty-mime.htm',
    mimeType: '',
    buffer: Buffer.from(bookmarkHtml(1)),
  });
  await complete(page);
  await page.evaluate(() => {
    File.prototype.arrayBuffer = () =>
      Promise.reject(new Error('synthetic read failure'));
  });
  await upload(page, bookmarkHtml(1));
  await expect(page.locator('#main-content').getByRole('alert')).toContainText(
    '파일을 읽지 못했어요',
  );
  await expect(page.getByRole('list', { name: '북마크 항목' })).toHaveCount(0);
});
test('hostile file preview remains text-only, requests zero external resources and zero POSTs', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  const external: string[] = [];
  await context.route('https://bookmark-attacker.invalid/**', async (route) => {
    external.push(route.request().url());
    await route.abort();
  });
  await page.goto('/links/import');
  await upload(page, bookmarkFixture('hostile.html'));
  await complete(page);
  await page.waitForTimeout(150);
  await expect(
    page.getByText('<img src=x onerror=alert(1)>', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(globalThis, 'bookmarkExecuted')),
  ).toBeUndefined();
  expect(external).toEqual([]);
  expect(
    fixture.requests.filter((request) => request.method() !== 'GET'),
  ).toEqual([]);
});
for (const width of [320, 390, 512, 1440]) {
  test(`preview layout and keyboard interaction at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/links/import');
    await upload(
      page,
      bookmarkHtml(30).replace('링크 0', '매우 긴 제목 日本語 '.repeat(25)),
    );
    await complete(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await expectLayoutWidth(page);
    await expect(
      page.getByRole('navigation', { name: '주요 메뉴' }),
    ).toBeVisible();
    const checkbox = page.getByRole('checkbox').first();
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await page.screenshot({
      path: `artifacts/wo-011-a/preview-${width}.png`,
      fullPage: true,
    });
  });
}
