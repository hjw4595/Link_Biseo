import { test, expect } from './auth-fixture';
import type { Page } from '@playwright/test';
import { fixtureId } from './product-fixture';

async function frame(page: Page) {
  return page.locator('#main-content').evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x, width: box.width };
  });
}

for (const width of [390, 640, 768, 1023, 1024, 1440])
  test(`auth loading, failure and all page frames use the same width ${width}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    const expected = Math.min(
      width,
      width < 768 ? 512 : width < 1024 ? 768 : 1152,
    );
    const expectedFrame = { x: (width - expected) / 2, width: expected };
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/auth/v1/user', async (route) => {
      await gate;
      await route.continue();
    });
    try {
      await page.goto('/settings');
      await expect(
        page.getByText('로그인 상태를 확인하고 있어요.'),
      ).toBeVisible();
      await expect(page.getByRole('navigation')).toHaveCount(0);
      expect(await frame(page)).toEqual(expectedFrame);
    } finally {
      release();
    }
    await expect(
      page.getByRole('heading', { name: '사용 통계', exact: true }),
    ).toBeVisible();
    expect(await frame(page)).toEqual(expectedFrame);
    await page.unroute('**/auth/v1/user');
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({ status: 503, json: { message: 'unavailable' } }),
    );
    await page.reload();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      '로그인 상태를 확인할 수 없어요',
    );
    expect(await frame(page)).toEqual(expectedFrame);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await page.unroute('**/auth/v1/user');

    await page.goto(`/links/${fixtureId('chatgpt')}`);
    await expect(
      page.getByRole('link', { name: '링크 열기', exact: true }),
    ).toBeVisible();
    expect(await frame(page)).toEqual(expectedFrame);
    const body = page.locator('[data-slot="app-sheet-body"]');
    await expect(body).toHaveCSS('padding-left', width < 768 ? '20px' : '24px');
    await expect(body).toHaveCSS(
      'padding-right',
      width < 768 ? '20px' : '24px',
    );
    await expect(page.locator('header')).toHaveCSS(
      'padding-left',
      width < 768 ? '20px' : '24px',
    );
    expect(
      await page
        .getByRole('navigation')
        .evaluate((node) => node.getBoundingClientRect().width),
    ).toBe(expected);

    await context.clearCookies();
    await page.goto('/login');
    await expect(
      page.getByRole('button', { name: 'Google로 계속하기' }),
    ).toBeVisible();
    expect(await frame(page)).toEqual(expectedFrame);
    await page.goto('/diagnostics');
    expect(await frame(page)).toEqual(expectedFrame);
    await page.goto('/unknown-page-width-check');
    await expect(
      page.getByText('페이지를 찾을 수 없어요', { exact: true }),
    ).toBeVisible();
    expect(await frame(page)).toEqual(expectedFrame);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
