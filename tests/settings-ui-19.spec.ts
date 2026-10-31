import { expectAccountVerified } from './account-assertions';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, authenticate } from './auth-fixture';
import { fixtureId, installProductApi } from './product-fixture';
import {
  categoryDistribution,
  categoryColor,
} from '../src/features/settings/adapters/category-distribution';
import type { CategoryResponse } from '../src/contracts/categories';
const before = process.env.WO_UI_19_CAPTURE === 'before';
const phase = before ? 'before' : 'after';
const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
function dataset(counts: number[], uncategorizedCount = 0) {
  const categories: CategoryResponse[] = counts.map((_, i) => ({
    id: fixtureId(`chart19-${i}`),
    name: i === 0 ? '개발' : i === 1 ? '디자인' : `카테고리 ${i + 1}`,
    sortOrder: i,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
  return {
    categories,
    summary: {
      items: categories.map((c, i) => ({ id: c.id, linkCount: counts[i]! })),
      uncategorizedCount,
      totalLinkCount: counts.reduce((a, b) => a + b, uncategorizedCount),
    },
  };
}
async function api(page: Page, data: ReturnType<typeof dataset>) {
  await page.route('**/categories', (route) =>
    route.fulfill({ headers, json: data.categories }),
  );
  await page.route('**/categories/summary', (route) =>
    route.fulfill({ headers, json: data.summary }),
  );
}
const list = (page: Page) =>
  page.getByRole('list', { name: '카테고리별 링크 수' });
const center = (page: Page) => page.getByTestId('donut-center');
async function capture(page: Page, name: string) {
  const dir = `artifacts/wo-ui-19/${phase}/${page.context().browser()?.browserType().name()}`;
  await mkdir(dir, { recursive: true });
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: `${dir}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}
for (const [name, counts, uncategorized, width] of [
  ['three', [30, 20, 10], 0, 1440],
  ['five', [40, 30, 20, 15, 10], 0, 1440],
  ['ten', Array.from({ length: 10 }, (_, i) => 20 - i), 0, 1440],
  ['thirty', Array.from({ length: 30 }, (_, i) => 40 - i), 5, 1440],
  ['example', [40, 30, 20, 15, 10, 8, 7], 5, 1440],
  ['mobile-390', [40, 30, 20, 15, 10, 8, 7], 5, 390],
  ['mobile-320', [40, 30, 20, 15, 10, 8, 7], 5, 320],
  ['zero', [], 0, 390],
] as const) {
  test(`capture distribution ${name}`, async ({ page }) => {
    const data = dataset([...counts], uncategorized);
    await api(page, data);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/settings');
    await expect(center(page)).toHaveText(
      `${data.summary.totalLinkCount.toLocaleString('ko-KR')}전체 링크`,
    );
    await expectAccountVerified(page);
    await page.evaluate(() => document.fonts.ready);
    await capture(page, name);
    if (before) return;
    const expected = Math.min(
      6,
      counts.filter((n) => n > 0).length + (uncategorized > 0 ? 1 : 0),
    );
    await expect(list(page).getByRole('button')).toHaveCount(expected);
    await expect(page.locator('path[data-category-id]')).toHaveCount(expected);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    for (const button of await list(page).getByRole('button').all())
      expect(
        await button.evaluate((el) => parseFloat(getComputedStyle(el).height)),
      ).toBeGreaterThanOrEqual(44);
  });
}

for (const size of [0, 1, 4, 5, 6, 7, 20, 50])
  for (const uncategorized of [0, 5]) {
    test(`exact grouping ${size} ordinary plus uncategorized ${uncategorized}`, () => {
      const data = dataset(
        Array.from({ length: size }, (_, i) => size - i),
        uncategorized,
      );
      const original = JSON.stringify(data);
      const result = categoryDistribution(data.summary, data.categories);
      expect(result.status).toBe('ready');
      if (result.status !== 'ready') throw new Error('ready');
      expect(result.items.length).toBe(
        Math.min(6, size + Number(uncategorized > 0)),
      );
      expect(result.items.reduce((sum, item) => sum + item.count, 0)).toBe(
        data.summary.totalLinkCount,
      );
      expect(result.items.every((item) => item.count > 0)).toBe(true);
      const grouped = size + Number(uncategorized > 0) > 6 || size > 5;
      const keep = grouped ? (uncategorized > 0 ? 4 : 5) : size;
      expect(result.items.slice(0, keep).map((item) => item.id)).toEqual(
        data.categories.slice(0, keep).map((c) => c.id),
      );
      const other = result.items.find((item) => item.id === 'other');
      if (grouped) {
        expect(other?.memberIds).toEqual(
          data.categories.slice(keep).map((c) => c.id),
        );
        expect(other?.count).toBe(
          data.summary.items
            .slice(keep)
            .reduce((sum, item) => sum + item.linkCount, 0),
        );
        expect(other?.percentage).toBe(
          (other!.count / data.summary.totalLinkCount) * 100,
        );
        expect(other?.color).toBe('#7B818D');
      } else expect(other).toBeUndefined();
      const unclassified = result.items.find(
        (item) => item.id === 'uncategorized',
      );
      if (uncategorized) {
        expect(unclassified?.count).toBe(uncategorized);
        expect(unclassified?.color).toBe('#D0C9BB');
      } else expect(unclassified).toBeUndefined();
      expect(JSON.stringify(data)).toBe(original);
    });
  }

test('example exact Other, zero exclusion, deterministic tie breaks and stable UUID colors', () => {
  const data = dataset([40, 30, 20, 15, 10, 8, 7, 0], 5);
  const result = categoryDistribution(data.summary, data.categories);
  if (result.status !== 'ready') throw new Error('ready');
  expect(result.items.map((item) => item.count)).toEqual([
    40, 30, 20, 15, 5, 25,
  ]);
  expect(result.items.at(-1)?.percentage).toBeCloseTo(18.5185185);
  expect(result.items.at(-1)?.memberIds).toHaveLength(3);
  const tie = dataset([1, 1, 1, 1, 1, 1, 1, 0]);
  tie.categories.forEach((c) => {
    c.sortOrder = 0;
  });
  const expected = tie.categories
    .slice(0, 7)
    .map((c) => c.id)
    .sort();
  const tied = categoryDistribution(tie.summary, [...tie.categories].reverse());
  if (tied.status !== 'ready') throw new Error('ready');
  expect(tied.items.slice(0, 5).map((item) => item.id)).toEqual(
    expected.slice(0, 5),
  );
  expect(tied.items.at(-1)?.memberIds).toEqual(expected.slice(5));
  const colors = new Map(result.items.map((item) => [item.id, item.color]));
  data.categories.forEach((c) => {
    c.name = '변경';
    c.sortOrder = 99 - c.sortOrder;
  });
  data.summary.items[0]!.linkCount = 39;
  data.summary.totalLinkCount--;
  const updated = categoryDistribution(data.summary, data.categories);
  if (updated.status !== 'ready') throw new Error('ready');
  for (const item of updated.items)
    expect(item.color).toBe(colors.get(item.id));
});

test('palette contrast and fixed group colors', async () => {
  function luminance(hex: string) {
    const c = hex.match(/[0-9a-f]{2}/gi)!.map((v) => {
      const n = parseInt(v, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
    return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
  }
  const colors = [
    '#F0B65E',
    '#51C2B8',
    '#819DFA',
    '#E78DAE',
    '#A5B2C4',
    '#7B818D',
    '#D0C9BB',
  ];
  const contrast = colors.map((color) => ({
    color,
    againstSurface: (luminance(color) + 0.05) / (luminance('#1F2022') + 0.05),
  }));
  for (const item of contrast)
    expect(item.againstSurface).toBeGreaterThanOrEqual(3);
  const data = dataset(Array.from({ length: 50 }, () => 1));
  const assigned = data.categories.map((c) => categoryColor(c.id));
  expect(new Set(assigned).size).toBe(5);
  for (const color of assigned) expect(colors.slice(0, 5)).toContain(color);
  await mkdir('artifacts/wo-ui-19', { recursive: true });
  await writeFile(
    'artifacts/wo-ui-19/color-contrast.json',
    JSON.stringify(
      {
        contrast,
        note: 'Unselected sector fills against Surface, not a blanket accessibility certification. Same UUID color collisions are separated by gaps and boundaries.',
      },
      null,
      2,
    ),
  );
});

test('Other hover, mouse, keyboard, uncategorized and reset do not navigate', async ({
  page,
}) => {
  await api(page, dataset([40, 30, 20, 15, 10, 8, 7], 5));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/settings');
  const other = list(page).getByRole('button', { name: /^기타/ });
  await other.click();
  await expect(center(page)).toHaveText('25기타18.5%');
  await expect(other).toHaveAttribute('aria-pressed', 'true');
  await capture(page, 'other-selected');
  await expect(page).toHaveURL('/settings');
  await other.click();
  await expect(center(page)).toHaveText('135전체 링크');
  await list(page).getByRole('button', { name: /^개발/ }).click();
  await capture(page, 'ordinary-selected');
  await page.getByTestId('donut').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('donut').boundingBox())!;
  const mid =
    (((110 / 135) * 348 + 10 + ((25 / 135) * 348) / 2) * Math.PI) / 180;
  const point = {
    x: box.x + box.width / 2 + 109 * Math.cos(mid),
    y: box.y + box.height / 2 - 109 * Math.sin(mid),
  };
  await page.mouse.move(point.x, point.y);
  await expect(page.getByRole('tooltip')).toContainText('기타 · 25개 · 18.5%');
  await expect(center(page)).toHaveText('40개발29.6%');
  // Keep the pointer over the sector in the tooltip screenshot.
  await page.screenshot({
    path: `artifacts/wo-ui-19/after/${page.context().browser()?.browserType().name()}/other-tooltip.png`,
    fullPage: true,
  });
  await page.mouse.click(point.x, point.y);
  await expect(center(page)).toHaveText('25기타18.5%');
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  await expect(center(page)).toHaveText('135전체 링크');
  await other.focus();
  await page.keyboard.press('Enter');
  await expect(center(page)).toHaveText('25기타18.5%');
  await page.keyboard.press('Space');
  await expect(center(page)).toHaveText('135전체 링크');
  await list(page)
    .getByRole('button', { name: /^미분류/ })
    .click();
  await expect(center(page)).toHaveText('5미분류3.7%');
});

test('rank changes preserve displayed UUID then clear a grouped-away selection; Other recalculates', async ({
  page,
}) => {
  const data = dataset([40, 30, 20, 15, 10, 8, 7], 5);
  await api(page, data);
  await page.clock.install();
  await page.goto('/settings');
  await list(page).getByRole('button', { name: /^개발/ }).click();
  const id = data.categories[0]!.id;
  const originalColor = await page
    .locator(`path[data-category-id="${id}"]`)
    .getAttribute('fill');
  async function refresh() {
    await page.clock.fastForward(16000);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
  }
  data.summary.items[0]!.linkCount = 25;
  data.summary.totalLinkCount = 120;
  data.categories[0]!.name = '개발 변경';
  await refresh();
  await expect(center(page)).toHaveText('25개발 변경20.8%');
  await expect(list(page).getByRole('button').nth(1)).toContainText(
    '개발 변경',
  );
  expect(
    await page.locator(`path[data-category-id="${id}"]`).getAttribute('fill'),
  ).toBe(originalColor);
  data.summary.items[0]!.linkCount = 1;
  data.summary.totalLinkCount = 96;
  await refresh();
  await expect(center(page)).toHaveText('96전체 링크');
  await expect(list(page).locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator(`path[data-category-id="${id}"]`)).toHaveCount(0);
  const other = list(page).getByRole('button', { name: /^기타/ });
  await other.click();
  await expect(center(page)).toHaveText('16기타16.7%');
  data.summary.items[0]!.linkCount = 2;
  data.summary.totalLinkCount = 97;
  await refresh();
  await expect(center(page)).toHaveText('17기타17.5%');
  data.summary.items = data.summary.items.slice(0, 4);
  data.categories = data.categories.slice(0, 4);
  data.summary.totalLinkCount = 72;
  await refresh();
  await expect(center(page)).toHaveText('72전체 링크');
  await expect(other).toHaveCount(0);
});

test('touch Other and safe tiny sector rendering with adjacent colliding preferred-color UUIDs', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 320, height: 900 },
  });
  await authenticate(context);
  await installProductApi(context);
  const page = await context.newPage();
  await api(page, dataset([40, 30, 20, 15, 10, 8, 7], 5));
  await page.goto('http://localhost:3100/settings');
  const other = list(page).getByRole('button', { name: /^기타/ });
  await other.tap();
  await expect(center(page)).toHaveText('25기타18.5%');
  await other.tap();
  await expect(center(page)).toHaveText('135전체 링크');
  const tiny = dataset([9999, 1]);
  await api(page, tiny);
  await page.reload();
  await expect(page.locator('path[data-category-id]')).toHaveCount(2);
  const path = page.locator(
    `path[data-category-id="${tiny.categories[1]!.id}"]`,
  );
  await expect(path).toHaveAttribute('stroke', 'none');
  expect(
    await path.evaluate((node: SVGPathElement) => node.getTotalLength()),
  ).toBeGreaterThan(0);
  await list(page)
    .getByRole('button', { name: /^디자인/ })
    .tap();
  await expect(center(page)).toHaveText('1디자인0.0%');
  await capture(page, 'tiny-sector');
  const data = dataset([5, 4, 3]);
  const match = dataset(Array.from({ length: 100 }, () => 1)).categories.find(
    (c) =>
      c.id !== data.categories[0]!.id &&
      categoryColor(c.id) === categoryColor(data.categories[0]!.id),
  )!;
  data.categories[1]!.id = match.id;
  data.summary.items[1]!.id = match.id;
  await api(page, data);
  await page.reload();
  await expect(page.locator('path[data-category-id]')).toHaveCount(3);
  const paths = page.locator('path[data-category-id]');
  expect(await paths.nth(0).getAttribute('fill')).not.toBe(
    await paths.nth(1).getAttribute('fill'),
  );
  for (const item of await paths.all()) {
    await expect(item).toHaveAttribute('stroke', 'var(--surface)');
    await expect(item).toHaveAttribute('stroke-width', '1');
  }
  await capture(page, 'adjacent-resolved-colors');
  await context.close();
});
