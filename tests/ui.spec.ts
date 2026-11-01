import { selectLinkFilter } from './link-filter-helper';
import { requestLinkDeletion } from './link-actions-helper';
import {
  expectLayoutWidth,
  expectClearOfNavigation,
} from './layout-assertions';
import { test, expect } from './auth-fixture';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test('ranked categories, favorites, filter, sort and detail navigation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '링크비서 홈', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation').getByRole('link', { name: '홈', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('region', { name: '카테고리', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '카테고리', exact: true })
    .click();
  const cards = page.getByRole('list', { name: '저장된 카테고리' });
  await expect(cards.locator(':scope > li')).toHaveCount(6);
  await cards.getByRole('link', { name: 'AI 링크 보기', exact: true }).click();
  await expect(page).toHaveURL(
    '/links?categoryId=32e83e92-d45d-41f6-8dcf-9d214688f037',
  );
  await expect(page.getByLabel('카테고리 필터')).toHaveValue(
    '32e83e92-d45d-41f6-8dcf-9d214688f037',
  );
  await expect(page.getByTestId('link-item')).toHaveCount(4);
  const favorite = page.getByRole('button', {
    name: 'Claude 즐겨찾기',
    exact: true,
  });
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(
    '/links?categoryId=32e83e92-d45d-41f6-8dcf-9d214688f037',
  );
  await selectLinkFilter(page, 'favorites');
  await expect(page.getByTestId('link-item')).toHaveCount(3);
  await selectLinkFilter(page, 'all');
  await page.getByLabel('정렬', { exact: true }).selectOption('frequent');
  await expect(page.getByTestId('link-item').first()).toContainText(
    'AI 리서치 레퍼런스',
  );
  await page.getByLabel('정렬', { exact: true }).selectOption('recent');
  await expect(page.getByTestId('link-item').first()).toContainText('ChatGPT');
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await expect(page).toHaveURL(
    '/links?categoryId=32e83e92-d45d-41f6-8dcf-9d214688f037&sort=recent',
  );
  await expect(
    page.getByRole('heading', { name: 'ChatGPT', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('button', { name: '정보 수정', exact: true }),
  ).toBeEnabled();
});

test('URL validation, API fixture save, favorite and delete', async ({
  page,
}) => {
  await page.goto('/links/new');
  await expect(
    page.getByRole('button', { name: '링크 등록', exact: true }),
  ).toBeDisabled();
  await page.locator('#link-url').fill('bad-url');
  await page.locator('#link-url').blur();
  await expect(page.getByText('올바른 URL을 입력해 주세요.')).toBeVisible();
  await page.locator('#link-url').fill('javascript:alert(1)');
  await page
    .locator('#category')
    .selectOption('32e83e92-d45d-41f6-8dcf-9d214688f037');
  await expect(
    page.getByRole('button', { name: '링크 등록', exact: true }),
  ).toBeDisabled();
  await expect(page).toHaveURL('/links/new');
  await page.locator('#link-url').fill('https://example.org/article');
  await page.getByRole('button', { name: '+ 설명 추가', exact: true }).click();
  await page.locator('#note').fill('테스트 메모');
  await page.getByRole('button', { name: '링크 등록', exact: true }).click();
  await expect(page).toHaveURL(/\/links\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('heading', { name: 'example.org' }),
  ).toBeVisible();
  await expect(page.getByText('테스트 메모')).toBeVisible();
  const detailUrl = page.url();
  await page.goto('/links');
  await page
    .getByRole('button', { name: 'example.org 즐겨찾기', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'example.org 즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.goto(detailUrl);
  await requestLinkDeletion(page);
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '링크 삭제', exact: true })
    .click();
  await expect(page).toHaveURL('/links');
  await expect(
    page.getByRole('link', { name: 'example.org 열기' }),
  ).toHaveCount(0);
});

test('empty category, missing resources, search, keyboard and favicon fallback', async ({
  page,
}) => {
  await page.goto('/category/d70afca6-1520-4838-8a3d-858e60dda12f');
  await expect(page.getByText('조건에 맞는 링크가 없어요.')).toBeVisible();
  await page.getByRole('link', { name: '링크 추가하기', exact: true }).click();
  await expect(page).toHaveURL(
    '/category/d70afca6-1520-4838-8a3d-858e60dda12f',
  );
  await expect(page.locator('#category')).toHaveValue(
    'd70afca6-1520-4838-8a3d-858e60dda12f',
  );
  await page.goto('/category/does-not-exist');
  await expect(page.getByText('페이지를 찾을 수 없어요')).toBeVisible();
  await page.goto('/links/does-not-exist');
  await expect(page.getByText('페이지를 찾을 수 없어요')).toBeVisible();
  await page.goto('/links');
  await page.getByRole('searchbox').fill('없는 검색어');
  await expect(page.getByText('검색 결과가 없어요.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '검색어 지우기', exact: true }),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('AI 리서치');
  await expect(page.getByTestId('link-item')).toHaveCount(1);
  await expect(page.getByTestId('link-item').locator('img')).toHaveCount(0);
  await page.getByRole('searchbox').clear();
  await page.getByLabel('카테고리 필터').focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: '즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('Health diagnosis retains error and retry states', async ({ page }) => {
  await page.route('**/health', (route) => route.abort());
  await page.goto('/diagnostics');
  await expect(page.getByText('Unavailable', { exact: true })).toBeVisible();
  await page.unroute('**/health');
  await page.route('**/health', (route) =>
    route.fulfill({ json: { status: 'ok' } }),
  );
  await page.getByRole('button', { name: '다시 확인' }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
});

test('development preview includes states and a small Bento', async ({
  page,
}) => {
  await page.goto('/dev/ui');
  await expect(
    page.getByRole('heading', { name: '링크비서 디자인 시스템' }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: '내 카테고리' }).last().getByRole('link'),
  ).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Loading' })).toBeDisabled();
  await expect(
    page.getByRole('navigation').getByRole('link', { name: /Preview/ }),
  ).toHaveCount(0);
});

for (const width of [320, 375, 390, 430, 512, 1440]) {
  test(`responsive screens at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const screenshotDir = path.resolve(
      process.cwd(),
      'artifacts/wo-003/screenshots',
    );
    await mkdir(screenshotDir, { recursive: true });
    for (const [name, route] of [
      ['home', '/'],
      ['category', '/category/32e83e92-d45d-41f6-8dcf-9d214688f037'],
      ['add', '/links/new'],
      ['detail', '/links/60965168-ce76-4e94-8600-281ba6d01fee'],
      ['long-detail', '/links/aee040a5-82bb-4aaa-86b5-4d4e16b84281'],
      ['empty', '/category/d70afca6-1520-4838-8a3d-858e60dda12f'],
    ]) {
      if (!name || !route) throw new Error('Invalid screenshot route');
      await page.goto(route);
      await expect(
        page.getByRole('navigation', {
          name: '주요 메뉴',
          includeHidden: name === 'add',
        }),
      ).toBeVisible();
      await expect(
        name === 'add'
          ? page.getByRole('heading', { name: '링크 등록', exact: true })
          : page.getByRole('heading', { level: 1 }),
      ).toBeVisible();
      if (name === 'home')
        await expect(
          page.getByRole('region', { name: '즐겨찾기', exact: true }),
        ).toBeVisible();
      if (name === 'category')
        await expect(page.getByTestId('link-item')).toHaveCount(4);
      if (name === 'empty')
        await expect(
          page.getByText('조건에 맞는 링크가 없어요.'),
        ).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        content: document.documentElement.scrollWidth,
        mainWidth: document.querySelector('main')?.getBoundingClientRect()
          .width,
      }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
      await expectLayoutWidth(page);
      await page.screenshot({
        path: path.join(screenshotDir, `${name}-${width}.png`),
        fullPage: true,
      });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expectClearOfNavigation(
        page,
        name === 'add'
          ? page.getByRole('button', { name: '링크 등록', exact: true })
          : page.locator('.screen-content'),
      );
    }
  });
}
