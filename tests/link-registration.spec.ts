import { registerLink } from './link-filter-helper';
import { mkdir } from 'node:fs/promises';
import { test, expect, testUser } from './auth-fixture';
import { fixtureId, installProductApi } from './product-fixture';
import { createLinkUrl } from '../src/features/links/create-url';

const api = 'http://127.0.0.1:54329';
const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const root = 'artifacts/wo-ui-07/screenshots';
const submit = { name: '링크 등록', exact: true };
test.beforeEach(async () => {
  await mkdir(root, { recursive: true });
});

test('registration URL policy matches server normalization and rejects malformed input', () => {
  for (const value of [
    '',
    'not a url',
    'https://a_b.com',
    'javascript:alert(1)',
    'data:text/plain,test',
    'file:///tmp/a',
    'https://user:pass@example.org',
    'https://example.org\\a',
    'https://example.org/\n',
    'https://example.org/\ud800',
  ])
    expect(createLinkUrl(value), value).toBeNull();
  expect(createLinkUrl('  HTTPS://Example.org/a#fragment  ')?.href).toBe(
    'https://example.org/a',
  );
  expect(createLinkUrl('http://example.org')?.href).toBe('http://example.org/');
});

for (const width of [320, 390, 512, 768, 1024, 1440, 1920]) {
  test(`registration layout and disclosures at ${width}px`, async ({
    page,
    context,
  }) => {
    const fixture = await installProductApi(context);
    await page.setViewportSize({ width, height: 900 });
    await page.route(`${api}/links/preview`, (route) =>
      route.fulfill({
        headers,
        json: {
          url: route.request().postDataJSON().url,
          domain: 'react.dev',
          title: 'React documentation',
          faviconUrl: 'https://react.dev/broken.ico',
          status: 'ready',
        },
      }),
    );
    await page.route('https://react.dev/broken.ico', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    await page.goto('/links/new');
    await expect(page.getByRole('button', submit)).toBeDisabled();
    await expect(page.getByLabel('링크 미리보기', { exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator('#note')).toBeHidden();
    await page.screenshot({
      path: `${root}/empty-${width}.png`,
      fullPage: true,
    });
    await page
      .getByLabel('URL', { exact: true })
      .fill('https://react.dev/wo-ui-07');
    await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
      'React documentation',
    );
    await expect(
      page.getByLabel('링크 미리보기', { exact: true }).locator('img'),
    ).toHaveCount(0);
    const star = page.getByRole('button', { name: '즐겨찾기', exact: true });
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await expect(star.locator('svg')).toHaveAttribute('fill', 'none');
    await page.screenshot({
      path: `${root}/preview-${width}.png`,
      fullPage: true,
    });
    await star.focus();
    await page.keyboard.press('Space');
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(star.locator('svg')).toHaveAttribute('fill', 'currentColor');
    expect(
      await star.evaluate((el) => el.getBoundingClientRect().width),
    ).toBeGreaterThanOrEqual(44);
    await expect(star).toHaveCSS('color', 'rgb(217, 183, 111)');
    await page.screenshot({
      path: `${root}/favorite-${width}.png`,
      fullPage: true,
    });
    const category = page.locator('button[aria-controls="new-category-panel"]');
    await category.click();
    await expect(category).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByLabel('새 카테고리 이름', { exact: true }),
    ).toBeFocused();
    await page.getByLabel('새 카테고리 이름', { exact: true }).fill('공부');
    await page.screenshot({
      path: `${root}/category-open-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await expect(page.locator('#category option:checked')).toHaveText('공부');
    await expect(category).toBeFocused();
    expect(
      fixture.requests.filter(
        (r) =>
          r.method() === 'POST' && new URL(r.url()).pathname === '/categories',
      ),
    ).toHaveLength(0);
    await page.screenshot({
      path: `${root}/category-selected-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: '+ 설명 추가', exact: true })
      .click();
    await expect(page.getByLabel('설명', { exact: true })).toBeFocused();
    await page.getByLabel('설명', { exact: true }).fill('개인 메모');
    await page.screenshot({
      path: `${root}/description-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: '설명 접기', exact: true }).click();
    await page
      .getByRole('button', { name: '설명 작성됨 · 수정', exact: true })
      .click();
    await expect(page.getByLabel('설명', { exact: true })).toHaveValue(
      '개인 메모',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page
        .locator('form')
        .evaluate((el) => el.getBoundingClientRect().width),
    ).toBeLessThanOrEqual(width < 1024 ? width : 512);
    await page.getByRole('button', { name: '설명 접기', exact: true }).click();
    await page.getByRole('button', submit).click();
    await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
    const state = fixture.users.get(testUser.id);
    const saved = state?.links.find(
      (l) => l.url === 'https://react.dev/wo-ui-07',
    );
    expect(saved).toMatchObject({
      title: 'React documentation',
      description: '개인 메모',
      isFavorite: true,
    });
    expect(state?.categories.find((c) => c.name === '공부')?.id).toBe(
      saved?.categoryId,
    );
  });
}

test('debounce, late A response, user title and new URL title isolation', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: string[] = [];
  await page.route(`${api}/links/preview`, async (route) => {
    const url: string = route.request().postDataJSON().url;
    requests.push(url);
    if (url.includes('/a')) await gate;
    await route
      .fulfill({
        headers,
        json: {
          url,
          domain: 'example.org',
          title: url.includes('/a') ? 'Old A' : 'New B',
          faviconUrl: null,
          status: 'ready',
        },
      })
      .catch(() => {});
  });
  await page.goto('/links/new');
  const input = page.getByLabel('URL', { exact: true });
  await input.fill('https://example.org/typing');
  await input.fill('https://example.org/a');
  await expect.poll(() => requests).toEqual(['https://example.org/a']);
  await page.getByLabel('제목', { exact: true }).fill('Manual A');
  await input.fill('https://example.org/b');
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
  await page.getByLabel('제목', { exact: true }).fill('Manual B');
  await expect.poll(() => requests.length).toBe(2);
  release();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
    'Manual B',
  );
  await input.fill('https://example.org/c');
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('New B');
});

test('failed preview allows minimal save; failed save preserves all fields and one request at a time', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  let posts = 0;
  await page.route(`${api}/links`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    posts++;
    if (posts === 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return route.fulfill({ headers, status: 503, json: {} });
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/links/new');
  await page
    .getByLabel('URL', { exact: true })
    .fill('https://example.org/retry-new');
  await expect(page.getByText('제목 정보를 가져오지 못했어요.')).toBeVisible();
  await page.getByRole('button', { name: '새 카테고리', exact: true }).click();
  await page.getByLabel('새 카테고리 이름', { exact: true }).fill('재시도');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await page.getByRole('button', submit).click();
  await expect(page.getByLabel('URL', { exact: true })).toBeDisabled();
  await page.screenshot({ path: `${root}/saving-1440.png`, fullPage: true });
  await expect(
    page
      .getByRole('dialog', { name: '링크 등록', exact: true })
      .getByRole('alert'),
  ).toBeVisible();
  expect(
    fixture.users.get(testUser.id)?.categories.some((c) => c.name === '재시도'),
  ).toBe(false);
  await expect(page.locator('#category option:checked')).toHaveText('재시도');
  await expect(page.getByLabel('URL', { exact: true })).toHaveValue(
    'https://example.org/retry-new',
  );
  await page.screenshot({
    path: `${root}/save-error-1440.png`,
    fullPage: true,
  });
  await page.getByRole('button', submit).click();
  await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
  expect(posts).toBe(2);
  expect(
    fixture.users
      .get(testUser.id)
      ?.categories.filter((c) => c.name === '재시도'),
  ).toHaveLength(1);
});

test('cancel drafts and duplicate category auto-selection never create orphan categories', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  await page.goto('/links/new');
  await page
    .getByLabel('URL', { exact: true })
    .fill('https://example.org/cancel');
  await page.getByRole('button', { name: '새 카테고리', exact: true }).click();
  await page.getByLabel('새 카테고리 이름', { exact: true }).fill(' 개발 ');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.locator('#category')).toHaveValue(fixtureId('development'));
  await page.getByRole('button', { name: '새 카테고리', exact: true }).click();
  await page.getByLabel('새 카테고리 이름', { exact: true }).fill('버릴 초안');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '닫기', exact: true }),
  ).toBeFocused();
  await expect(page.locator('#category option:checked')).toHaveText(
    '버릴 초안',
  );
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '버리고 나가기', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  expect(
    fixture.users
      .get(testUser.id)
      ?.categories.some((c) => c.name === '버릴 초안'),
  ).toBe(false);
  expect(
    fixture.requests.filter(
      (r) =>
        r.method() === 'POST' &&
        ['/categories', '/links'].includes(new URL(r.url()).pathname),
    ),
  ).toHaveLength(0);
});

test('browser Back cancellation preserves the draft and later confirmation follows history', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  await expect(page).toHaveURL('/links');
  await expect(page.getByTestId('link-item')).toHaveCount(8);
  await registerLink(page);
  await page
    .getByLabel('URL', { exact: true })
    .fill('https://example.org/browser-back');
  const dismissed = page
    .waitForEvent('dialog')
    .then((dialog) => dialog.dismiss());
  await page.evaluate(() => history.back());
  await dismissed;
  await expect(page).toHaveURL('/links');
  await expect(page.getByLabel('URL', { exact: true })).toHaveValue(
    'https://example.org/browser-back',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.goBack();
  await expect(page).toHaveURL('/');
});
