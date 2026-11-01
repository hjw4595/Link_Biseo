import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Locator } from '@playwright/test';
import { test, expect, testUser } from './auth-fixture';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import {
  expectLayoutWidth,
  expectClearOfNavigation,
} from './layout-assertions';

const before = process.env.WO_UI_16_CAPTURE === 'before';
const phase = before ? 'before' : 'after';
const root = 'artifacts/wo-ui-16';
async function box(locator: Locator) {
  const value = await locator.boundingBox();
  if (!value) throw new Error('Visible element required');
  return value;
}

for (const width of [320, 390, 512, 768, 1024, 1440, 1920])
  test(`My Links layout, density and interactions ${width}`, async ({
    page,
    context,
    browserName,
  }) => {
    const api = await installProductApi(context);
    const state = initialProduct();
    api.users.set(testUser.id, state);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/links');
    const rows = page.getByTestId('link-item');
    await expect(rows).toHaveCount(8);
    await expect(
      page.getByText('전체 링크 8개', { exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    const dir = `${root}/${phase}/${browserName}`;
    await mkdir(dir, { recursive: true });
    const shot = (name: string) =>
      page.screenshot({
        path: `${dir}/${name}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    const header = page.locator('#main-content > header');
    const input = page.getByRole('searchbox');
    const category = page.getByLabel('카테고리 필터', { exact: true });
    const sort = page.getByLabel('정렬', { exact: true });
    const metrics = {
      header: await box(header),
      search: await box(input),
      first: await box(rows.first()),
      second: await box(rows.nth(1)),
      category: await box(category),
      sort: await box(sort),
    };
    await writeFile(
      `${dir}/metrics-${width}.json`,
      JSON.stringify(metrics, null, 2),
    );
    await shot('links');
    if (before) return;

    await expectLayoutWidth(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(metrics.first.height).toBeGreaterThanOrEqual(52);
    expect(metrics.first.height).toBeLessThanOrEqual(60);
    expect(metrics.second.y - metrics.first.y - metrics.first.height).toBe(1);
    await expect(rows.nth(1).locator('..')).toHaveCSS(
      'border-bottom-width',
      '1px',
    );
    await expect(rows.first().locator('img')).toHaveCount(0);
    const title = rows.first().getByRole('link');
    const star = rows.first().getByRole('button', { name: /즐겨찾기$/ });
    const detail = rows.first().getByRole('button', { name: /상세 보기$/ });
    for (const action of [title, star, detail]) {
      const bounds = await box(action);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
    }
    const count = await box(page.getByText('전체 링크 8개', { exact: true }));
    expect(count.y + count.height).toBeLessThanOrEqual(
      metrics.header.y + metrics.header.height,
    );
    expect(metrics.search.x).toBe(metrics.first.x);
    if (width >= 1024) {
      const actions = await box(page.getByRole('group', { name: '링크 작업' }));
      expect(actions.x).toBeGreaterThan(
        (await box(page.getByRole('heading', { name: '내 링크', exact: true })))
          .x + 200,
      );
      expect(actions.y + actions.height).toBeLessThanOrEqual(
        metrics.header.y + metrics.header.height,
      );
      expect(actions.x + actions.width).toBe(
        metrics.search.x + metrics.search.width,
      );
      expect(metrics.sort.x + metrics.sort.width).toBe(
        metrics.search.x + metrics.search.width,
      );
      expect(metrics.sort.y).toBe(metrics.category.y);
      expect(metrics.category.width).toBeGreaterThanOrEqual(220);
      expect(metrics.category.width).toBeLessThanOrEqual(260);
      expect(metrics.sort.width).toBeGreaterThanOrEqual(150);
      expect(metrics.sort.width).toBeLessThanOrEqual(180);
      const previous = await readFile(
        `${root}/before/chromium/metrics-${width}.json`,
        'utf8',
      );
      const old: {
        search: { y: number };
        first: { y: number; height: number };
      } = JSON.parse(previous);
      expect(metrics.search.y).toBeLessThan(old.search.y);
      expect(metrics.first.y).toBeLessThan(old.first.y);
      expect(metrics.first.height).toBeLessThan(old.first.height);
      await rows.first().hover();
      await expect(rows.first()).toHaveCSS(
        'background-color',
        'rgb(31, 32, 34)',
      );
      expect((await box(rows.first())).height).toBe(metrics.first.height);
      await shot('hover');
    } else {
      await expect(page.getByRole('group', { name: '링크 작업' })).toHaveCount(
        0,
      );
      await page
        .getByRole('button', { name: '내 링크 더보기', exact: true })
        .click();
      await expect(
        page.getByRole('menuitem', { name: '북마크 가져오기', exact: true }),
      ).toHaveAttribute('href', '/links/import');
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: '내 링크 더보기', exact: true }),
      ).toBeFocused();
      if (width <= 390)
        expect(metrics.sort.y).toBeGreaterThan(metrics.category.y);
    }
    // Establish keyboard modality, then verify each native control's visible focus.
    await page.keyboard.press('Tab');
    await title.focus();
    await expect(title).toBeFocused();
    await expect(title).toHaveCSS('outline-style', 'solid');
    if (width === 1440) await shot('keyboard-title');
    await page.keyboard.press('Tab');
    await expect(star).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(detail).toBeFocused();
    if (width === 1440) await shot('keyboard-detail');
    await detail.click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await shot('detail');
    await page.keyboard.press('Escape');
    await expect(detail).toBeFocused();
    await expect(page).toHaveURL('/links');

    state.links[0]!.title = '긴 한글 제목과 EnglishTitle '.repeat(24);
    state.links[1]!.title = 'VeryLongEnglishTitleWithoutSpaces'.repeat(24);
    await page.reload();
    await expect(rows).toHaveCount(8);
    for (const link of state.links.slice(0, 2)) {
      const text = page
        .getByRole('link', { name: `${link.title} 열기`, exact: true })
        .locator('.truncate');
      await expect(text).toHaveCSS('text-overflow', 'ellipsis');
      await expect(text).toHaveCSS('font-weight', '500');
      expect(
        await text.evaluate((node) => node.scrollWidth > node.clientWidth),
      ).toBe(true);
    }
    await shot('long-titles');
    await category.selectOption(fixtureId('design'));
    await page.getByRole('button', { name: '즐겨찾기', exact: true }).click();
    await sort.selectOption('frequent');
    await input.fill('LongEnglish');
    await expect(rows).toHaveCount(1);
    await shot('filters');
    await page.getByRole('button', { name: '초기화', exact: true }).click();
    await expect(rows).toHaveCount(8);
    await rows.last().evaluate((node) => node.scrollIntoView({ block: 'end' }));
    await expectClearOfNavigation(page, rows.last());
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });

for (const width of [390, 1440])
  test(`Home favorites remain visually unchanged ${width}`, async ({
    page,
    browserName,
  }) => {
    await presetApi(page, 2);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByTestId('link-item')).toHaveCount(3);
    await expect(
      page.getByRole('button', { name: '비서의 추천', exact: true }),
    ).toBeVisible();
    if (width >= 1024)
      await expect(
        page.getByRole('button', { name: '업무 1 펼치기' }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole('button', { name: '업무 1 펼치기' }),
      ).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    const dir = `${root}/${phase}/${browserName}`;
    await mkdir(dir, { recursive: true });
    const image = await page.screenshot({
      path: `${dir}/home-${width}.png`,
      animations: 'disabled',
    });
    if (!before && browserName === 'chromium')
      // Brand rollout intentionally adds the mark to the header; retain a full-frame pixel baseline.
      expect(image).toMatchSnapshot(`home-brand-${width}.png`, {
        maxDiffPixels: 0,
      });
  });
