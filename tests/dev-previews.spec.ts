import { test, expect } from './auth-fixture';
import { devPreviewsEnabled } from '../src/screens/dev/access';

test('previews require an explicit opt-in and never run outside development', () => {
  for (const NODE_ENV of ['production', 'test', undefined]) {
    for (const ENABLE_DEV_PREVIEWS of ['true', 'false', undefined]) {
      expect(devPreviewsEnabled({ NODE_ENV, ENABLE_DEV_PREVIEWS })).toBe(false);
    }
  }
  for (const ENABLE_DEV_PREVIEWS of ['false', 'TRUE', '1', undefined]) {
    expect(
      devPreviewsEnabled({ NODE_ENV: 'development', ENABLE_DEV_PREVIEWS }),
    ).toBe(false);
  }
  expect(
    devPreviewsEnabled({
      NODE_ENV: 'development',
      ENABLE_DEV_PREVIEWS: 'true',
    }),
  ).toBe(true);
});

test('disabled previews cannot replace the report or mount the demo gallery', async ({
  page,
}) => {
  test.skip(process.env.ENABLE_DEV_PREVIEWS !== 'false');
  await page.goto('/dev/ui');
  // The root loading boundary may stream HTTP 200 before notFound resolves.
  await expect(
    page.getByText('페이지를 찾을 수 없어요', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    /noindex/,
  );
  await expect(
    page.getByRole('heading', { name: '링크비서 디자인 시스템' }),
  ).toHaveCount(0);
  await page.goto('/assistant/organization?preview=cleanup');
  await expect(
    page.getByRole('heading', { name: '미사용 링크 정리 검증' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '지금 정리할 부분을 살펴봐요' }),
  ).toBeVisible();
});

test('enabled UI gallery is excluded from indexing and product navigation', async ({
  page,
}) => {
  test.skip(process.env.ENABLE_DEV_PREVIEWS === 'false');
  await page.goto('/dev/ui');
  await expect(
    page.getByRole('heading', { name: '링크비서 디자인 시스템' }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  );
  await expect(
    page.getByRole('navigation').locator('a[href^="/dev"]'),
  ).toHaveCount(0);
});

test('public diagnostics describe the real API without advertising demos', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto('/diagnostics');
  await expect(
    page.getByRole('heading', { name: 'API 서버 상태' }),
  ).toBeVisible();
  await expect(page.getByText(/데모|Foundation/)).toHaveCount(0);
  await expect(page.locator('a[href^="/dev"]')).toHaveCount(0);
});
