import { test, expect } from './auth-fixture';
import type { Page } from '@playwright/test';
import { fixtureId } from './product-fixture';

async function holdGet(page: Page, pattern: string) {
  let release = () => {};
  let requests = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    requests++;
    await gate;
    if (!page.isClosed()) await route.fallback();
  });
  return { release, requests: () => requests };
}
const loading = (page: Page, text: string) =>
  page.getByRole('status').filter({ hasText: text });

for (const width of [390, 1440])
  test(`links load inside the list while heading, filters and navigation stay mounted ${width}`, async ({
    page,
  }) => {
    const gate = await holdGet(page, '**/links?*');
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/links');
      await expect(loading(page, '링크를 불러오고 있어요.')).toBeVisible();
      const title = page.getByRole('heading', { name: '내 링크', exact: true });
      await expect(title).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: '주요 메뉴' }),
      ).toBeVisible();
      await expect(page.getByRole('searchbox')).toBeEnabled();
      await expect(
        page.getByLabel('카테고리 필터', { exact: true }),
      ).toBeEnabled();
      await title.evaluate((node) =>
        node.setAttribute('data-stable-loading-test', 'true'),
      );
      expect(
        await loading(page, '링크를 불러오고 있어요.')
          .locator('a, button, input')
          .count(),
      ).toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/content-skeleton/links-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      gate.release();
      await expect(
        page.getByRole('link', { name: 'ChatGPT 열기', exact: true }),
      ).toBeVisible();
      await expect(title).toHaveAttribute('data-stable-loading-test', 'true');
    } finally {
      gate.release();
    }
  });

test('category keeps its real top bar and back action during category discovery', async ({
  page,
}) => {
  const gate = await holdGet(page, '**/categories');
  try {
    await page.goto(`/category/${fixtureId('ai')}`);
    await expect(loading(page, '카테고리를 불러오고 있어요.')).toBeVisible();
    const header = page.locator('header');
    await expect(header).toContainText('카테고리');
    await expect(page.getByRole('link', { name: '뒤로 가기' })).toBeVisible();
    await header.evaluate((node) =>
      node.setAttribute('data-stable-loading-test', 'true'),
    );
    gate.release();
    await expect(
      page.getByRole('heading', { name: 'AI', exact: true }),
    ).toBeVisible();
    await expect(header).toHaveAttribute('data-stable-loading-test', 'true');
  } finally {
    gate.release();
  }
});

test('detail Sheet loads only its body and remains dismissible', async ({
  page,
}) => {
  const gate = await holdGet(page, `**/links/${fixtureId('chatgpt')}`);
  try {
    await page.goto('/links');
    await page.getByRole('button', { name: 'ChatGPT 상세 보기' }).click();
    const sheet = page.getByRole('dialog');
    await expect(
      sheet.getByRole('heading', { name: '링크 상세', exact: true }),
    ).toBeVisible();
    await expect(loading(page, '링크를 불러오고 있어요.')).toBeVisible();
    await expect(
      sheet.getByRole('button', { name: '닫기', exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: 'artifacts/content-skeleton/detail-sheet.png',
      fullPage: true,
      animations: 'disabled',
    });
    gate.release();
    await expect(
      sheet.getByText('ChatGPT', { exact: true }).first(),
    ).toBeVisible();
    await expect(loading(page, '링크를 불러오고 있어요.')).toHaveCount(0);
  } finally {
    gate.release();
  }
});

test('settings skeletons stay in statistic values and chart without fabricating zero', async ({
  page,
}) => {
  const usage = await holdGet(page, '**/users/me/usage-summary?*');
  const summary = await holdGet(page, '**/categories/summary');
  try {
    await page.goto('/settings');
    const total = page.locator('[aria-label="전체 링크"]');
    await expect(total.getByRole('status')).toBeVisible();
    await expect(total).not.toContainText('0개');
    await expect(loading(page, '링크 분포를 불러오는 중…')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '사용 통계', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel('미사용 링크 추천 기간', { exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: '로그아웃', exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: 'artifacts/content-skeleton/settings.png',
      fullPage: true,
      animations: 'disabled',
    });
    usage.release();
    summary.release();
    await expect(total).toContainText('8개');
    await expect(loading(page, '링크 분포를 불러오는 중…')).toHaveCount(0);
  } finally {
    usage.release();
    summary.release();
  }
});

test('background list refresh keeps existing rows instead of mounting skeletons', async ({
  page,
}) => {
  await page.goto('/links');
  const row = page.getByRole('link', { name: 'ChatGPT 열기', exact: true });
  await expect(row).toBeVisible();
  await row.evaluate((node) =>
    node.setAttribute('data-stable-loading-test', 'true'),
  );
  const gate = await holdGet(page, '**/links?*');
  try {
    await page.clock.install();
    await page.clock.fastForward(16000);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
    await expect.poll(gate.requests).toBeGreaterThan(0);
    await expect(row).toHaveAttribute('data-stable-loading-test', 'true');
    await expect(loading(page, '링크를 불러오고 있어요.')).toHaveCount(0);
  } finally {
    gate.release();
  }
});

test('content skeletons announce loading once and respect reduced motion', async ({
  page,
}) => {
  const gate = await holdGet(page, '**/links?*');
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/links');
    const region = loading(page, '링크를 불러오고 있어요.');
    await expect(region).toHaveCount(1);
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toHaveAttribute('aria-atomic', 'true');
    await expect(region.locator('[aria-hidden="true"]').first()).toBeAttached();
    const shape = region.locator('.rounded-sm').first();
    await expect(shape).toHaveCSS('animation-name', 'none');
  } finally {
    gate.release();
  }
});
