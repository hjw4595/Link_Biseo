import { test, expect } from './auth-fixture';
import { fixtureId } from './product-fixture';
import { mkdir } from 'node:fs/promises';
const labels = ['홈', '카테고리', '내 링크', '설정'];
const icons = ['house', 'folder', 'link2', 'settings2'];
for (const width of [320, 390, 512, 768, 1024, 1440, 1920]) {
  test(`navigation layout, icons and target sizes at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/links');
    const nav = page.getByRole('navigation', { name: '주요 메뉴' });
    const brand = nav.getByRole('link', {
      name: 'LINK BISEO 홈으로 이동',
      includeHidden: true,
    });
    if (width >= 1024) await expect(brand).toBeVisible();
    else await expect(brand).toBeHidden();
    const bounds = await nav.boundingBox();
    if (!bounds) throw Error('Missing navigation');
    if (width >= 1024) {
      expect(bounds.height).toBe(64);
      expect(bounds.width).toBe(Math.min(width, 1152));
    } else {
      expect(bounds.y + bounds.height).toBe(900);
      expect(
        await nav.evaluate((el) =>
          parseFloat(getComputedStyle(el).paddingBottom),
        ),
      ).toBeGreaterThanOrEqual(12);
    }
    const items = [];
    for (const [index, label] of labels.entries()) {
      const link = nav.getByRole('link', { name: label, exact: true });
      const box = await link.boundingBox();
      if (!box) throw Error('Missing link');
      items.push(box);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      const icon = link.locator('svg');
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      await expect(icon).toHaveClass(new RegExp(`lucide-${icons[index]}`));
      await expect(icon).toHaveCSS('width', width >= 1024 ? '18px' : '20px');
      if (width >= 1024) expect(box.width).toBeLessThan(bounds.width / 4);
    }
    if (width < 1024)
      for (const item of items)
        expect(Math.abs(item.width - items[0]!.width)).toBeLessThan(1);
    await expect(nav.locator('[aria-current="page"]')).toHaveText('내 링크');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
test('active parent routes survive direct entry and reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [path, label] of [
    ['/', '홈'],
    ['/categories', '카테고리'],
    [`/category/${fixtureId('development')}`, '카테고리'],
    ['/links', '내 링크'],
    [`/links/${fixtureId('chatgpt')}`, '내 링크'],
    ['/links/new', '내 링크'],
    ['/links/import', '내 링크'],
    ['/assistant/organization', '내 링크'],
    ['/settings', '설정'],
  ]) {
    await page.goto(path!);
    const active = page.locator('nav [aria-current="page"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveText(label!);
    await page.reload();
    await expect(active).toHaveText(label!);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(1440);
  }
});
test('desktop brand, native new tab, hover, keyboard and history', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/links');
  const nav = page.getByRole('navigation');
  const brand = nav.getByRole('link', { name: 'LINK BISEO 홈으로 이동' });
  const categories = nav.getByRole('link', { name: '카테고리', exact: true });
  const before = await categories.boundingBox();
  await categories.hover();
  expect(await categories.boundingBox()).toEqual(before);
  expect(
    await categories.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe('rgba(0, 0, 0, 0)');
  await brand.focus();
  await page.keyboard.press('Tab');
  await expect(
    nav.getByRole('link', { name: '홈', exact: true }),
  ).toBeFocused();
  expect(
    await nav
      .getByRole('link', { name: '홈', exact: true })
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe('solid');
  await page.keyboard.press('Tab');
  await expect(categories).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/categories');
  await brand.click();
  await expect(page).toHaveURL('/');
  await page.goBack();
  await expect(page).toHaveURL('/categories');
  await page.goForward();
  await expect(page).toHaveURL('/');
  await nav.getByRole('link', { name: '설정', exact: true }).click();
  await expect(page).toHaveURL('/settings');
  const tab = context.waitForEvent('page');
  await brand.click({ modifiers: ['ControlOrMeta'] });
  const opened = await tab;
  await opened.waitForURL('**/');
  await opened.close();
  await expect(page).toHaveURL('/settings');
});
test('Sheet and discard Dialog keep navigation isolated and restore its focus order', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/links');
  await page.getByRole('link', { name: '링크 등록', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '링크 등록', exact: true });
  await expect(sheet).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.locator('#link-url').fill('https://example.com/navigation');
  await mkdir('artifacts/wo-ui-20/after', { recursive: true });
  await page.screenshot({
    path: 'artifacts/wo-ui-20/after/registration-sheet.png',
    animations: 'disabled',
  });
  await sheet.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.screenshot({
    path: 'artifacts/wo-ui-20/after/discard-dialog.png',
    animations: 'disabled',
  });
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '취소', exact: true })
    .click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '버리고 나가기', exact: true })
    .click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('navigation')).toBeVisible();
});
test('200 percent viewport zoom and larger text preserve navigation reflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto('/links');
  await expect(
    page.getByRole('link', { name: 'LINK BISEO 홈으로 이동' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(720);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.evaluate(() => (document.documentElement.style.fontSize = '20px'));
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1024);
  await expect(
    page.getByRole('link', { name: 'LINK BISEO 홈으로 이동' }),
  ).toBeVisible();
});

test.describe('mobile touch navigation', () => {
  test.use({ hasTouch: true });
  test('all four tabs navigate by touch and update the active menu', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: '주요 메뉴' });
    for (const [label, path] of [
      ['카테고리', '/categories'],
      ['내 링크', '/links'],
      ['설정', '/settings'],
      ['홈', '/'],
    ]) {
      await nav.getByRole('link', { name: label!, exact: true }).tap();
      await expect(page).toHaveURL(path!);
      await expect(nav.locator('[aria-current="page"]')).toHaveText(label!);
      await expect(nav.getByRole('link')).toHaveCount(4);
    }
  });
});
