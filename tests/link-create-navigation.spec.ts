import { registerLink } from './link-filter-helper';
import type { Page } from '@playwright/test';
import { expectClearOfNavigation } from './layout-assertions';
import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, testUser } from './auth-fixture';
import {
  fixtureId,
  initialProduct,
  installProductApi,
} from './product-fixture';

const api = 'http://127.0.0.1:54329';
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
const development = fixtureId('development');
const design = fixtureId('design');
const screenshots = 'artifacts/wo-008/screenshots';
const saveName = { name: '링크 등록', exact: true };
const cancelName = { name: '닫기', exact: true };

async function enterCategory(page: Page, name: string, paths?: string[]) {
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '카테고리', exact: true })
    .click();
  paths?.push('/categories');
  await page
    .getByRole('link', { name: `${name} 링크 보기`, exact: true })
    .click();
}

test.beforeEach(async () => {
  await mkdir(screenshots, { recursive: true });
});

for (const width of [320, 390, 512, 1440]) {
  for (const scenario of ['same', 'changed', 'uncategorized'] as const) {
    test(`category ${scenario}: destination, cache, Back and clicks at ${width}px`, async ({
      page,
      context,
    }, info) => {
      const fixture = await installProductApi(context);
      await page.setViewportSize({ width, height: 900 });
      // Warm the destination's cached list before entering from development.
      if (scenario === 'changed') {
        await page.goto('/');
        await enterCategory(page, '디자인');
        await expect(page.getByTestId('link-item').first()).toBeVisible();
        await page
          .getByRole('navigation')
          .getByRole('link', { name: '홈', exact: true })
          .click();
        await expect(page).toHaveURL('/');
      } else await page.goto('/');
      const paths = [new URL(page.url()).pathname];
      await enterCategory(page, '개발', paths);
      await expect(page).toHaveURL(`/links?categoryId=${development}`);
      await expect(page.getByTestId('link-item').first()).toBeVisible();
      paths.push(new URL(page.url()).pathname + new URL(page.url()).search);
      const before = fixture.requests.filter(
        (r) => r.method() === 'GET' && new URL(r.url()).pathname === '/links',
      ).length;
      await registerLink(page);
      await expect(page.locator('#category')).toHaveValue(development);
      paths.push(new URL(page.url()).pathname + new URL(page.url()).search);
      const category =
        scenario === 'same'
          ? development
          : scenario === 'changed'
            ? design
            : '';
      if (scenario !== 'same')
        await page.locator('#category').selectOption(category);
      const title = `WO008-${scenario}-${width}`;
      await page.locator('#link-url').fill(`https://example.org/${title}`);
      await page.locator('#custom-title').fill(title);
      await page.getByRole('button', saveName).scrollIntoViewIfNeeded();
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await expectClearOfNavigation(page, page.getByRole('button', saveName));
      await page.screenshot({
        path: `${screenshots}/form-${scenario}-${width}.png`,
      });
      await page.getByRole('button', saveName).click();
      const destination = `/links?categoryId=${category || 'uncategorized'}`;
      await expect(page).toHaveURL(destination);
      paths.push(new URL(page.url()).pathname + new URL(page.url()).search);
      await expect(
        page.getByRole('link', { name: `${title} 열기`, exact: true }),
      ).toBeVisible();
      const after = fixture.requests.filter(
        (r) => r.method() === 'GET' && new URL(r.url()).pathname === '/links',
      ).length;
      expect(after).toBeGreaterThan(before);
      const state = fixture.users.get(testUser.id);
      expect(state?.links.find((l) => l.title === title)?.categoryId).toBe(
        category || null,
      );
      expect(
        fixture.requests.filter(
          (r) =>
            r.method() === 'POST' && new URL(r.url()).pathname === '/links',
        ),
      ).toHaveLength(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await page.screenshot({
        path: `${screenshots}/saved-${scenario}-${width}.png`,
        fullPage: true,
      });
      await page.goBack();
      await expect(page).toHaveURL(`/links?categoryId=${development}`);
      await expect(page.locator('#link-url')).toHaveCount(0);
      const back = new URL(page.url()).pathname;
      await info.attach('flow-measurement', {
        contentType: 'application/json',
        body: JSON.stringify({
          width,
          scenario,
          paths,
          ctaActivations: 4,
          categorySelections: scenario === 'same' ? 0 : 1,
          screenTransitions: paths.length - 1,
          back,
        }),
      });
      // Persist measured URLs as a reviewable artifact, independently of reporter output.
      await info.attach('saved-data', {
        contentType: 'application/json',
        body: JSON.stringify(state?.links.find((l) => l.title === title)),
      });
      await writeFile(
        `artifacts/wo-008/flow-${scenario}-${width}.json`,
        JSON.stringify(
          {
            paths,
            ctaActivations: 4,
            categorySelections: scenario === 'same' ? 0 : 1,
            screenTransitions: paths.length - 1,
            back,
          },
          null,
          2,
        ),
      );
    });
  }

  test(`general save and cancel preserve policy at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/links');
    await registerLink(page);
    await expect(page.locator('#category')).toHaveValue('');
    await page.locator('#category').selectOption(design);
    const title = `general-${width}`;
    await page.locator('#link-url').fill(`https://example.org/${title}`);
    await page.locator('#custom-title').fill(title);
    await page.getByRole('button', saveName).click();
    await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `${screenshots}/general-detail-${width}.png`,
      fullPage: true,
    });
    await page.goBack();
    await expect(page).toHaveURL('/links');
    await expect(page.locator('#link-url')).toHaveCount(0);
    await registerLink(page);
    await page.getByRole('button', cancelName).click();
    if (await page.getByRole('alertdialog').isVisible())
      await page
        .getByRole('button', { name: '버리고 나가기', exact: true })
        .click();
    await expect(page).toHaveURL('/links');
  });

  test(`invalid category correction and layout at ${width}px`, async ({
    page,
    context,
  }) => {
    const fixture = await installProductApi(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/links/new?categoryId=invalid');
    // The Korean status is also associated with the select for screen readers.
    await expect(page.locator('#initial-category-status')).toHaveText(
      '선택한 카테고리를 찾을 수 없어 미분류로 변경했어요.',
    );
    await expect(page.locator('#initial-category-status')).toHaveAttribute(
      'role',
      'status',
    );
    await expect(page.locator('#category')).toHaveValue('');
    await expect(page.locator('#category')).toHaveAttribute(
      'aria-describedby',
      'initial-category-status',
    );
    await expect(page.getByRole('button', saveName)).toBeDisabled();
    await page.locator('#link-url').fill('javascript:alert(1)');
    await page.locator('#link-url').blur();
    await expect(page.locator('#url-error')).toHaveAttribute('role', 'alert');
    await page.locator('#category').focus();
    await expect(page.locator('#category')).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `${screenshots}/invalid-category-${width}.png`,
      fullPage: true,
    });
    await page
      .locator('#link-url')
      .fill(`https://example.org/invalid-${width}`);
    await page.getByRole('button', saveName).click();
    await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
    expect(
      fixture.requests
        .find(
          (r) =>
            r.method() === 'POST' && new URL(r.url()).pathname === '/links',
        )
        ?.postDataJSON(),
    ).toMatchObject({ categoryId: null });
  });
}

for (const change of [false, true]) {
  test(`category cancel returns to origin after edit=${change}`, async ({
    page,
  }) => {
    await page.goto('/');
    await enterCategory(page, '개발');
    await expect(page).toHaveURL(`/links?categoryId=${development}`);
    await expect(page.getByLabel('카테고리 필터')).toHaveValue(development);
    await registerLink(page);
    await expect(page.locator('#category')).toHaveValue(development);
    await page.locator('#link-url').fill('https://example.org/cancelled');
    if (change) await page.locator('#category').selectOption(design);
    await page.getByRole('button', cancelName).click();
    if (await page.getByRole('alertdialog').isVisible())
      await page
        .getByRole('button', { name: '버리고 나가기', exact: true })
        .click();
    await expect(page).toHaveURL(`/links?categoryId=${development}`);
  });
}

for (const initial of ['invalid', fixtureId('other-owner'), '']) {
  test(`unverified or general entry cancel is safe: ${initial || 'none'}`, async ({
    page,
  }) => {
    await page.goto(`/links/new${initial ? `?categoryId=${initial}` : ''}`);
    await expect(page.locator('#category option')).toHaveCount(7);
    await page.getByRole('button', cancelName).click();
    if (await page.getByRole('alertdialog').isVisible())
      await page
        .getByRole('button', { name: '버리고 나가기', exact: true })
        .click();
    await expect(page).toHaveURL('/');
  });
}

for (const chooseWhileLoading of [false, true]) {
  test(`cold loading and explicit selection protection: edited=${chooseWhileLoading}`, async ({
    page,
  }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`${api}/categories`, async (route) => {
      await gate;
      await route.fallback();
    });
    await page.goto(`/links/new?categoryId=${development}`);
    await expect(page.getByRole('button', saveName)).toBeDisabled();
    await expect(page.locator('#initial-category-status')).toHaveCount(0);
    await page.locator('#link-url').fill('https://example.org/cold');
    if (chooseWhileLoading) await page.locator('#category').selectOption('');
    release();
    await expect(page.locator('#category option')).toHaveCount(7);
    await expect(page.locator('#category')).toHaveValue(
      chooseWhileLoading ? '' : development,
    );
    await expect(page.locator('#link-url')).toHaveValue(
      'https://example.org/cold',
    );
    await expect(page.locator('#initial-category-status')).toHaveCount(0);
  });
}

test('category error waits for retry before validation and preserves chosen uncategorized', async ({
  page,
}) => {
  let fail = true;
  await page.route(`${api}/categories`, (route) =>
    fail
      ? route.fulfill({ headers: cors, status: 503, json: {} })
      : route.fallback(),
  );
  await page.goto(`/links/new?categoryId=${development}`);
  await expect(
    page
      .getByRole('dialog', { name: '링크 등록', exact: true })
      .getByRole('alert'),
  ).toBeVisible();
  await expect(page.locator('#initial-category-status')).toHaveCount(0);
  await expect(page.getByRole('button', saveName)).toBeDisabled();
  await page.locator('#category').selectOption('');
  fail = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('#category option')).toHaveCount(7);
  await expect(page.locator('#category')).toHaveValue('');
  await page.getByRole('button', cancelName).click();
  if (await page.getByRole('alertdialog').isVisible())
    await page
      .getByRole('button', { name: '버리고 나가기', exact: true })
      .click();
  await expect(page).toHaveURL(`/category/${development}`);
});

test('failed save preserves inputs and locks repeated submit and cancel', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route(`${api}/links`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    posts++;
    if (posts === 1) {
      await gate;
      return route.fulfill({ status: 503, headers: cors, json: {} });
    }
    return route.fallback();
  });
  await page.goto(`/links/new?categoryId=${development}`);
  await expect(page.locator('#category option')).toHaveCount(7);
  await page.locator('#link-url').fill('https://example.org/retry');
  await page.locator('#custom-title').fill('재시도 제목');
  await page.getByRole('button', { name: '+ 설명 추가', exact: true }).click();
  await page.locator('#note').fill('재시도 설명');
  await page.getByRole('button', { name: '즐겨찾기', exact: true }).click();
  await page.getByRole('button', saveName).click();
  await expect(
    page.getByRole('button', { name: '등록 중…', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('button', cancelName)).toBeDisabled();
  await page.locator('form').evaluate((form) => {
    if (!(form instanceof HTMLFormElement))
      throw new Error('Expected link form');
    form.requestSubmit();
    form.requestSubmit();
  });
  expect(posts).toBe(1);
  release();
  await expect(
    page
      .getByRole('dialog', { name: '링크 등록', exact: true })
      .getByRole('alert'),
  ).toBeVisible();
  await expect(page.locator('#link-url')).toHaveValue(
    'https://example.org/retry',
  );
  await expect(page.locator('#custom-title')).toHaveValue('재시도 제목');
  await expect(page.locator('#note')).toHaveValue('재시도 설명');
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#category')).toHaveValue(development);
  await expect(page).toHaveURL(`/links/new?categoryId=${development}`);
  await page.screenshot({
    path: `${screenshots}/failed-save.png`,
    fullPage: true,
  });
  await page.getByRole('button', saveName).click();
  await expect(page).toHaveURL(`/category/${development}`);
  expect(posts).toBe(2);
  expect(
    fixture.users
      .get(testUser.id)
      ?.links.find((l) => l.title === '재시도 제목'),
  ).toMatchObject({ categoryId: development, isFavorite: true });
});

test('saved response category wins over submitted selection, even after a deletion race', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  await page.goto(`/links/new?categoryId=${development}`);
  await expect(page.locator('#category option')).toHaveCount(7);
  const seed = initialProduct().links[0];
  if (!seed) throw new Error('Missing fixture');
  const saved = {
    ...seed,
    id: fixtureId('server-result'),
    title: '서버 저장 결과',
    categoryId: design,
  };
  await page.route(`${api}/links`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    expect(route.request().postDataJSON()).toMatchObject({
      categoryId: development,
    });
    const state = fixture.users.get(testUser.id);
    if (!state) throw new Error('Missing product state');
    state.categories = state.categories.filter((c) => c.id !== development);
    state.links.push(saved);
    return route.fulfill({ status: 201, headers: cors, json: saved });
  });
  await page.locator('#link-url').fill('https://example.org/response');
  await page.getByRole('button', saveName).click();
  await expect(page).toHaveURL(`/category/${design}`);
  await expect(
    page.getByRole('link', { name: '서버 저장 결과 열기', exact: true }),
  ).toBeVisible();
});

test('category deletion rejection preserves form and can recover with another category', async ({
  page,
}) => {
  await page.goto(`/links/new?categoryId=${development}`);
  await expect(page.locator('#category option')).toHaveCount(7);
  await page.route(`${api}/links`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 404, headers: cors, json: {} })
      : route.fallback(),
  );
  await page.locator('#link-url').fill('https://example.org/deleted-category');
  await page.getByRole('button', saveName).click();
  await expect(
    page
      .getByRole('dialog', { name: '링크 등록', exact: true })
      .getByRole('alert'),
  ).toContainText('카테고리를 찾을 수 없어요');
  await expect(page.locator('#link-url')).toHaveValue(
    'https://example.org/deleted-category',
  );
  await page.unroute(`${api}/links`);
  await page.locator('#category').selectOption(design);
  await page.getByRole('button', saveName).click();
  await expect(page).toHaveURL(`/category/${design}`);
});

test('new category creation keeps category entry for completion', async ({
  page,
  context,
}) => {
  const fixture = await installProductApi(context);
  await page.goto(`/links/new?categoryId=${development}`);
  await expect(page.locator('#category option')).toHaveCount(7);
  await page.getByRole('button', { name: '새 카테고리', exact: true }).click();
  await page.locator('#new-category').fill('WO008 새 카테고리');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.locator('#category option:checked')).toHaveText(
    'WO008 새 카테고리',
  );
  expect(
    fixture.users
      .get(testUser.id)
      ?.categories.some((c) => c.name === 'WO008 새 카테고리'),
  ).toBe(false);
  await page.locator('#link-url').fill('https://example.org/new-category');
  await page.getByRole('button', saveName).click();
  await expect
    .poll(
      () =>
        fixture.users
          .get(testUser.id)
          ?.categories.find((c) => c.name === 'WO008 새 카테고리')?.id,
    )
    .toBeTruthy();
  const created = fixture.users
    .get(testUser.id)
    ?.categories.find((c) => c.name === 'WO008 새 카테고리');
  await expect(page).toHaveURL(`/category/${created?.id}`);
});

test('a destination deleted after server save uses the existing missing category screen', async ({
  page,
}) => {
  await page.goto(`/links/new?categoryId=${development}`);
  await expect(page.locator('#category option')).toHaveCount(7);
  const seed = initialProduct().links[0];
  if (!seed) throw new Error('Missing fixture');
  const deleted = fixtureId('deleted-after-save');
  await page.route(`${api}/links`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          headers: cors,
          status: 201,
          json: {
            ...seed,
            id: fixtureId('deleted-result'),
            categoryId: deleted,
          },
        })
      : route.fallback(),
  );
  await page
    .locator('#link-url')
    .fill('https://example.org/deleted-after-save');
  await page.getByRole('button', saveName).click();
  await expect(page).toHaveURL(`/category/${deleted}`);
  await expect(
    page.getByText('카테고리를 찾을 수 없어요', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('#link-url')).toHaveCount(0);
});

test('direct entry without an app predecessor replaces history without inventing a Back target', async ({
  page,
}, info) => {
  await page.goto('/links/new');
  await expect(page.locator('#category option')).toHaveCount(7);
  const before = await page.evaluate(() => history.length);
  await page.locator('#link-url').fill('https://example.org/direct');
  await page.getByRole('button', saveName).click();
  await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
  expect(await page.evaluate(() => history.length)).toBe(before);
  await page.goBack();
  expect(page.url()).not.toContain('/links/new');
  await info.attach('direct-history', {
    contentType: 'application/json',
    body: JSON.stringify({ historyLengthBefore: before, backUrl: page.url() }),
  });
});

test('foreign unreturned initial category can be corrected and repeated params stay general', async ({
  page,
}) => {
  await page.goto(`/links/new?categoryId=${fixtureId('other-owner')}`);
  await expect(page.locator('#initial-category-status')).toBeVisible();
  await page.locator('#category').selectOption(design);
  await page.locator('#link-url').fill('https://example.org/foreign-corrected');
  await page.getByRole('button', saveName).click();
  await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
  await page.goto(`/links/new?categoryId=${development}&categoryId=${design}`);
  await expect(page.locator('#category option')).toHaveCount(7);
  await expect(page.locator('#category')).toHaveValue('');
  await page.getByRole('button', cancelName).click();
  if (await page.getByRole('alertdialog').isVisible())
    await page
      .getByRole('button', { name: '버리고 나가기', exact: true })
      .click();
  await expect(page).toHaveURL('/');
});
