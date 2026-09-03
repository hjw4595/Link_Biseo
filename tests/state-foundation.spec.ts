import { expectAccountVerified } from './account-assertions';
import { test, expect } from './auth-fixture';

test('existing client state hydrates across protected screens without console errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' ||
      (message.type() === 'warning' &&
        /hydrat|did not match|server rendered/i.test(message.text()))
    ) {
      errors.push(message.text());
    }
  });
  // Supply valid external images so third-party hosts do not affect hydration checks.
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'image') {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    } else await route.fallback();
  });
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: '즐겨찾기', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '내 링크', exact: true })
    .click();
  await expect(
    page.getByRole('searchbox', { name: '저장한 링크 검색' }),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('ChatGPT');
  await page
    .getByRole('button', { name: 'ChatGPT 상세 보기', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'ChatGPT', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL('/links?q=ChatGPT');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'ChatGPT 상세 보기', exact: true }),
  ).toBeFocused();
  await page.goto('/links/60965168-ce76-4e94-8600-281ba6d01fee');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'ChatGPT', exact: true }),
  ).toBeVisible();
  await page.goto('/links/new');
  await expect(
    page.getByRole('button', { name: '링크 등록', exact: true }),
  ).toBeDisabled();
  await page.goto('/categories');
  await expect(
    page.getByRole('button', { name: 'AI 관리', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: '설정', exact: true })
    .click();
  await expectAccountVerified(page);
  expect(errors).toEqual([]);
});
