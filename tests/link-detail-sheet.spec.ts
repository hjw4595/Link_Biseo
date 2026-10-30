import { mkdir } from 'node:fs/promises';
import { test, expect, testUser, authenticate } from './auth-fixture';
import {
  fixtureId,
  initialProduct,
  installProductApi,
} from './product-fixture';
import { editLinkInfo, requestLinkDeletion } from './link-actions-helper';

const id = fixtureId('chatgpt');
for (const width of [320, 390, 512, 768, 1024, 1440, 1920]) {
  test(`one detail Sheet preserves URL/list and edits inline ${width}`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    await page.setViewportSize({ width, height: 900 });
    await mkdir('artifacts/wo-ui-10/after', { recursive: true });
    await page.goto('/links');
    await expect(page.getByTestId('link-item')).toHaveCount(8);
    await page.screenshot({
      path: `artifacts/wo-ui-10/after/list-${width}.png`,
      animations: 'disabled',
      fullPage: true,
    });
    await page.goto('/links?q=ChatGPT&favorite=true');
    const url = page.url();
    const opener = page.getByRole('button', {
      name: 'ChatGPT 상세 보기',
      exact: true,
    });
    await opener.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toHaveCount(1);
    await expect(
      sheet.getByRole('heading', { name: 'ChatGPT', exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(url);
    await expect(sheet.getByRole('link', { name: /열기/ })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: '링크 관리' })).toHaveCount(
      0,
    );
    await expect
      .poll(async () => Math.round((await sheet.boundingBox())?.width ?? 0))
      .toBe(width < 1024 ? width : 512);
    const identity = await sheet.elementHandle();
    await mkdir('artifacts/wo-ui-10/after', { recursive: true });
    await page.screenshot({
      path: `artifacts/wo-ui-10/after/detail-${width}.png`,
      animations: 'disabled',
    });
    await editLinkInfo(page);
    await expect(sheet.getByLabel('제목', { exact: true })).toBeFocused();
    await expect(sheet.getByLabel('설명', { exact: true })).toBeVisible();
    await sheet.getByLabel('제목', { exact: true }).fill('수정한 ChatGPT');
    expect(
      api.users.get(testUser.id)?.links.find((link) => link.id === id)?.title,
    ).toBe('ChatGPT');
    await page.screenshot({
      path: `artifacts/wo-ui-10/after/edit-${width}.png`,
      animations: 'disabled',
    });
    await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(
      sheet.getByRole('heading', { name: '수정한 ChatGPT', exact: true }),
    ).toBeVisible();
    expect(
      await identity?.evaluate(
        (node) => node === document.querySelector('[data-app-sheet]'),
      ),
    ).toBe(true);
    await expect(page).toHaveURL(url);
    await expect(
      sheet.getByRole('button', { name: '정보 수정', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(
      page.getByRole('button', {
        name: '수정한 ChatGPT 상세 보기',
        exact: true,
      }),
    ).toBeFocused();
    await expect(page.getByRole('searchbox')).toHaveValue('ChatGPT');
    expect(
      api.requests.filter((request) => request.url().endsWith('/open')),
    ).toHaveLength(0);
  });
}

test('delete Sheet stays on category, restores a surviving control and keeps unrelated links', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  await page.goto(`/category/${fixtureId('ai')}`);
  const url = page.url();
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await requestLinkDeletion(page);
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '링크 삭제', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(url);
  await expect(
    page.getByRole('button', { name: 'ChatGPT 상세 보기', exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.activeElement?.hasAttribute('data-link-detail'),
      ),
    )
    .toBe(true);
  expect(api.users.get(testUser.id)?.links).toHaveLength(7);
});

test('search, order, loaded pages, scroll and list DOM survive sequential Sheets', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  const base = state.links[0];
  if (!base) throw new Error('Missing fixture');
  state.links = Array.from({ length: 45 }, (_, index) => ({
    ...base,
    id: fixtureId(`preserve-${index}`),
    title: `보존 테스트 ${index}`,
    isFavorite: false,
    clickCount: index,
  }));
  api.users.set(testUser.id, state);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/links?q=보존');
  await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
  await expect(page.getByTestId('link-item')).toHaveCount(20);
  await page.getByRole('button', { name: '더 보기', exact: true }).click();
  await expect(page.getByTestId('link-item')).toHaveCount(40);
  const input = await page.getByRole('searchbox').elementHandle();
  const url = page.url();
  for (const index of [25, 26]) {
    const opener = page
      .getByTestId('link-item')
      .nth(index)
      .getByRole('button', { name: /상세 보기$/ });
    await opener.evaluate((node) => node.scrollIntoView({ block: 'center' }));
    const scroll = await page.evaluate(() => scrollY);
    await opener.click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
    expect(
      await input?.evaluate(
        (node) => node === document.querySelector('input[type=search]'),
      ),
    ).toBe(true);
    await expect(page.getByTestId('link-item')).toHaveCount(40);
    await expect(page.getByRole('searchbox')).toHaveValue('보존');
    await expect(page.getByLabel('정렬', { exact: true })).toHaveValue(
      'frequent',
    );
    await expect(page).toHaveURL(url);
  }
});

for (const failure of [403, 404, 500, 'network'] as const) {
  test(`Sheet query ${failure} hides unavailable data and supports recovery`, async ({
    page,
  }) => {
    let fail = true;
    await page.route(`http://127.0.0.1:54329/links/${id}`, (route) =>
      !fail
        ? route.fallback()
        : failure === 'network'
          ? route.abort('failed')
          : route.fulfill({
              headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3100',
              },
              status: failure,
              json: {},
            }),
    );
    await page.goto('/links');
    const url = page.url();
    const opener = page.getByRole('button', {
      name: 'ChatGPT 상세 보기',
      exact: true,
    });
    await opener.click();
    const sheet = page.getByRole('dialog');
    if (failure === 404)
      await expect(
        sheet.getByText('링크를 찾을 수 없어요', { exact: true }),
      ).toBeVisible();
    else await expect(sheet.getByRole('alert')).toBeVisible();
    if (failure === 403)
      await expect(sheet.getByRole('alert')).toHaveText('접근 권한이 없어요.');
    await expect(
      sheet.getByRole('button', { name: '정보 수정', exact: true }),
    ).toHaveCount(0);
    await expect(
      sheet.getByRole('heading', { name: 'ChatGPT', exact: true }),
    ).toHaveCount(0);
    fail = false;
    if (failure === 404) {
      await page.keyboard.press('Escape');
      await opener.click();
    } else
      await sheet
        .getByRole('button', { name: '다시 시도', exact: true })
        .click();
    await expect(
      sheet.getByRole('heading', { name: 'ChatGPT', exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(url);
  });
}

test('account switch removes an open private draft and the old Sheet', async ({
  page,
  context,
}) => {
  await page.goto('/links');
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await editLinkInfo(page);
  await page.getByLabel('제목', { exact: true }).fill('A 계정의 비공개 초안');
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('제목', { exact: true })).toHaveCount(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '설정', exact: true })
    .click();
  await expect(page.getByText('second@example.test')).toBeVisible();
});

for (const width of [390, 1440]) {
  test(`long content has one scrolling body and fixed regions ${width}`, async ({
    page,
    context,
  }) => {
    const api = await installProductApi(context);
    const state = initialProduct();
    const row = state.links.find((link) => link.id === id);
    if (!row) throw new Error('Missing fixture');
    row.title = '긴 제목과 공백 없는 문자를 확인하는 제목 '.repeat(6);
    row.url = `https://example.test/${'long-path/'.repeat(100)}`;
    row.description = '긴 설명과 줄바꿈을 확인해요.\n'.repeat(80);
    api.users.set(testUser.id, state);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/links');
    await page
      .getByRole('button', { name: `${row.title} 상세 보기`, exact: true })
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { level: 1 })).toBeVisible();
    const body = sheet.locator('[data-slot=app-sheet-body]');
    const footer = sheet.locator('[data-slot=app-sheet-footer]');
    await expect
      .poll(async () => Math.round((await footer.boundingBox())?.y ?? 0))
      .toBe(819);
    expect(
      await body.evaluate((node) => node.scrollHeight > node.clientHeight),
    ).toBe(true);
    await body.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    expect(Math.round((await footer.boundingBox())?.y ?? 0)).toBe(819);
    expect(
      Math.round(
        (await sheet.locator('[data-slot=app-sheet-header]').boundingBox())
          ?.y ?? 0,
      ),
    ).toBe(0);
    await page.screenshot({
      path: `artifacts/wo-ui-10/after/long-${width}.png`,
      animations: 'disabled',
    });
    await editLinkInfo(page);
    await sheet.getByLabel('설명', { exact: true }).scrollIntoViewIfNeeded();
    await sheet.getByLabel('설명', { exact: true }).fill('수정 중인 긴 콘텐츠');
    await page.setViewportSize({ width, height: 450 });
    await expect
      .poll(async () => Math.round((await sheet.boundingBox())?.height ?? 0))
      .toBe(450);
    const actions = await footer.getByRole('button').evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
      })),
    );
    expect(actions[0]?.width).toBe(actions[1]?.width);
    expect(actions[0]?.height).toBe(actions[1]?.height);
    expect(
      await body.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/wo-ui-10/after/keyboard-sim-${width}.png`,
      animations: 'disabled',
    });
  });
}

for (const failure of [500, 'network'] as const) {
  test(`background ${failure} keeps good detail mounted; idle time causes no detail polling`, async ({
    page,
  }) => {
    await page.clock.install();
    let reads = 0,
      fail = false;
    await page.route(`http://127.0.0.1:54329/links/${id}`, (route) => {
      reads++;
      return fail && failure === 'network'
        ? route.abort('failed')
        : fail
          ? route.fulfill({
              headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3100',
              },
              status: 500,
              json: {},
            })
          : route.fallback();
    });
    await page.goto('/links');
    await page
      .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
      .click();
    const sheet = page.getByRole('dialog');
    await expect(
      sheet.getByRole('heading', { name: 'ChatGPT', exact: true }),
    ).toBeVisible();
    const identity = await sheet.elementHandle();
    const initialReads = reads;
    await page.clock.fastForward(60000);
    expect(reads).toBe(initialReads);
    fail = true;
    await sheet
      .getByRole('button', { name: '정보 새로고침', exact: true })
      .click();
    await expect(sheet.getByRole('alert')).toBeVisible();
    await expect(
      sheet.getByRole('heading', { name: 'ChatGPT', exact: true }),
    ).toBeVisible();
    expect(await identity?.evaluate((node) => node.isConnected)).toBe(true);
    fail = false;
    await sheet.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(sheet.getByRole('alert')).toHaveCount(0);
  });
}

for (const status of [403, 404]) {
  for (const editing of [false, true]) {
    test(`cached detail ${status} hides private content and actions while editing=${editing}`, async ({
      page,
    }) => {
      let fail = false;
      await page.route(`http://127.0.0.1:54329/links/${id}`, (route) =>
        fail
          ? route.fulfill({
              headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3100',
              },
              status,
              json: {},
            })
          : route.fallback(),
      );
      await page.goto('/links');
      const opener = page.getByRole('button', {
        name: 'ChatGPT 상세 보기',
        exact: true,
      });
      await opener.click();
      const sheet = page.getByRole('dialog');
      await expect(
        sheet.getByRole('heading', { name: 'ChatGPT', exact: true }),
      ).toBeVisible();
      if (editing) {
        await editLinkInfo(page);
        await sheet
          .getByLabel('제목', { exact: true })
          .fill('비공개 편집 초안');
      }
      fail = true;
      await sheet
        .getByRole('button', { name: '정보 새로고침', exact: true })
        .click();
      await expect(
        sheet.getByText(
          status === 403 ? '접근 권한이 없어요.' : '링크를 찾을 수 없어요',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(sheet.locator('form')).toHaveCount(0);
      await expect(sheet.getByLabel('링크 URL', { exact: true })).toHaveCount(
        0,
      );
      await expect(
        sheet.getByRole('button', {
          name: /^(정보 수정|변경 저장|삭제|URL 복사)$/,
        }),
      ).toHaveCount(0);
      await expect(sheet.getByLabel('제목', { exact: true })).toHaveCount(0);
      // Reopen the same cached resource after access is restored.
      fail = false;
      if (status === 403) {
        await sheet
          .getByRole('button', { name: '다시 시도', exact: true })
          .click();
        if (editing)
          await expect(sheet.getByLabel('제목', { exact: true })).toHaveValue(
            '비공개 편집 초안',
          );
        else
          await expect(
            sheet.getByRole('heading', { name: 'ChatGPT', exact: true }),
          ).toBeVisible();
      } else {
        await page.keyboard.press('Escape');
        if (editing)
          await page
            .getByRole('button', { name: '변경 사항 버리기', exact: true })
            .click();
        await opener.click();
        await expect(
          sheet.getByRole('heading', { name: 'ChatGPT', exact: true }),
        ).toBeVisible();
      }
    });
  }
}

test('deleting the final Home favorite preserves Home and focuses the empty list', async ({
  page,
  context,
}) => {
  const api = await installProductApi(context);
  const state = initialProduct();
  state.links = state.links.filter((link) => link.id === id);
  api.users.set(testUser.id, state);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await requestLinkDeletion(page);
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '링크 삭제', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('/');
  await expect(
    page.getByText('즐겨찾기한 링크가 없어요.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('저장한 링크 목록', { exact: true }),
  ).toBeFocused();
});

test('saving category keeps the Sheet when its source row disappears', async ({
  page,
}) => {
  await page.goto(`/category/${fixtureId('ai')}`);
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await editLinkInfo(page);
  const sheet = page.getByRole('dialog');
  await sheet
    .getByLabel('카테고리', { exact: true })
    .selectOption(fixtureId('design'));
  await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(
    sheet.getByRole('button', { name: '정보 수정', exact: true }),
  ).toBeFocused();
  await expect(sheet.getByText('디자인', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(`/category/${fixtureId('ai')}`);
  await expect(
    page.getByRole('button', { name: 'ChatGPT 상세 보기', exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.activeElement?.hasAttribute('data-link-detail'),
      ),
    )
    .toBe(true);
});
