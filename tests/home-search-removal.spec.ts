import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from './auth-fixture';
import { installProductApi, initialProduct } from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import {
  expectLayoutWidth,
  expectClearOfNavigation,
} from './layout-assertions';

for (const width of [320, 390, 512, 768, 1024, 1440, 1920]) {
  test(`Home has no search, preserves bounded favorites and responsive actions ${width}px`, async ({
    page,
    context,
    browserName,
  }) => {
    const product = await installProductApi(context);
    const presets = await presetApi(page, 2);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByTestId('link-item')).toHaveCount(3);
    await expect(
      page.getByRole('heading', { name: '링크비서 홈', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await expect(page.getByRole('search')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: '전체 링크 검색' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '검색어 지우기' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: '카테고리', exact: true }),
    ).toHaveCount(0);
    const registration = page.getByRole('link', {
      name: '링크 추가',
      exact: true,
    });
    await expect(registration).toHaveAttribute('href', '/links/new');
    const button = await registration.boundingBox();
    expect(button!.width).toBeGreaterThanOrEqual(44);
    expect(button!.height).toBeGreaterThanOrEqual(44);
    if (width >= 1024) {
      await expect(
        page
          .getByRole('list', { name: '빠른 실행 목록' })
          .locator(':scope > li'),
      ).toHaveCount(2);
      await expect(
        page.getByRole('button', { name: '실행', exact: true }),
      ).toHaveCount(2);
      await expect.poll(() => presets.requests.length).toBe(3);
    } else {
      await expect(
        page.getByRole('region', { name: '빠른 실행', exact: true }),
      ).toHaveCount(0);
      expect(presets.requests).toHaveLength(0);
    }
    const reads = product.requests.filter(
      (request) =>
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/links',
    );
    expect(reads).toHaveLength(1);
    const query = new URL(reads[0]!.url()).searchParams;
    expect(query.get('favorite')).toBe('true');
    expect(query.get('limit')).toBe('6');
    expect(query.has('q')).toBe(false);
    expect(query.has('cursor')).toBe(false);
    expect(
      product.requests.some(
        (request) =>
          request.method() !== 'GET' &&
          new URL(request.url()).pathname !== '/organization-reports',
      ),
    ).toBe(false);
    expect(
      await page
        .locator('.screen-content > section')
        .evaluateAll((nodes) =>
          nodes.map(
            (node) =>
              node.querySelector('h2 button')?.getAttribute('aria-label') ??
              node.querySelector('h2')?.textContent?.trim(),
          ),
        ),
    ).toEqual(
      width >= 1024
        ? ['빠른 실행', '즐겨찾기', '비서의 추천']
        : ['즐겨찾기', '비서의 추천'],
    );
    await expectLayoutWidth(page);
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      content: document
        .querySelector('.screen-content')
        ?.getBoundingClientRect()
        .toJSON(),
      header: document
        .querySelector('main > header')
        ?.getBoundingClientRect()
        .toJSON(),
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
    const directory = `artifacts/wo-ui-12/${browserName}/after`;
    await mkdir(directory, { recursive: true });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.screenshot({
      path: `${directory}/home-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await writeFile(
      `${directory}/home-${width}.json`,
      JSON.stringify(
        {
          kind: 'Actual React UI / Mock HTTP API',
          metrics,
          linkQueries: reads.map((request) => request.url()),
          presetRequests: presets.requests,
        },
        null,
        2,
      ),
    );
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectClearOfNavigation(page, page.locator('.screen-content'));
    await registration.click();
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('dialog', { name: '링크 등록', exact: true }),
    ).toBeVisible();
    await expect(page.locator('#link-url')).toBeVisible();
  });
}

test('My Links search and favorite updates never become Home search requests; detail stays in its Sheet', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  await page.goto('/');
  await expect(page.getByTestId('link-item')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'ChatGPT', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL('/');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'ChatGPT 상세 보기', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'ChatGPT 즐겨찾기', exact: true })
    .click();
  await expect(page.getByTestId('link-item')).toHaveCount(2);
  expect(
    product.requests.filter((request) => request.url().endsWith('/open')),
  ).toHaveLength(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  await page
    .getByRole('searchbox', { name: '저장한 링크 검색' })
    .fill('ChatGPT');
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'ChatGPT 즐겨찾기', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'ChatGPT 즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'ChatGPT 즐겨찾기', exact: true }),
  ).toBeEnabled();
  const before = product.requests.length;
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '홈', exact: true })
    .click();
  await expect(page.getByTestId('link-item')).toHaveCount(3);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  const homeReads = product.requests
    .slice(before)
    .filter((request) => new URL(request.url()).pathname === '/links');
  expect(homeReads.length).toBeGreaterThan(0);
  for (const request of homeReads) {
    const query = new URL(request.url()).searchParams;
    expect(query.get('favorite')).toBe('true');
    expect(query.get('limit')).toBe('6');
    expect(query.has('q')).toBe(false);
  }
});

test('PC preset editor retains server link search, category combination and draft save in the same Sheet', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  const presets = await presetApi(page, 2);
  await page.setViewportSize({ width: 1440, height: 900 });
  const presetId = presets.items[0]!.id;
  await page.goto('/');
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  await page.getByRole('button', { name: '편집', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toHaveCount(1);
  const identity = await sheet.elementHandle();
  await page.getByRole('button', { name: '+ 링크 추가', exact: true }).click();
  await sheet
    .getByRole('searchbox', { name: '포함할 링크 검색' })
    .fill('react.dev');
  const category = initialProduct().categories.find(
    (row) => row.name === '개발',
  )!;
  await sheet.getByLabel('카테고리 필터').selectOption(category.id);
  await expect(
    sheet.getByRole('list', { name: '등록된 링크 선택' }).getByRole('listitem'),
  ).toHaveCount(1);
  await sheet.getByRole('button', { name: /^React.* 추가$/ }).click();
  expect(
    product.requests.some((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === '/links' &&
        url.searchParams.get('q') === 'react.dev' &&
        url.searchParams.get('categoryId') === category.id
      );
    }),
  ).toBe(true);
  expect(await identity?.evaluate((element) => element.isConnected)).toBe(true);
  expect(presets.requests.every((request) => request.method === 'GET')).toBe(
    true,
  );
  await sheet.getByRole('button', { name: /^선택 완료/ }).click();
  await expect(
    sheet.getByRole('list', { name: '선택한 링크 순서' }).getByRole('listitem'),
  ).toHaveCount(3);
  await sheet.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  expect(
    presets.items.find((preset) => preset.id === presetId)?.links,
  ).toHaveLength(3);
  expect(
    presets.requests.filter((request) => request.method === 'PATCH'),
  ).toHaveLength(1);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
});
