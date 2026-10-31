import { expectAccountVerified } from './account-assertions';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { fixtureId, initialProduct } from './product-fixture';
import {
  categoryColor,
  categoryDistribution,
} from '../src/features/settings/adapters/category-distribution';
import type { CategoryResponse } from '../src/contracts/categories';
const before = process.env.WO_UI_191_CAPTURE === 'before';
const root = `artifacts/wo-ui-19-1/${before ? 'before' : 'after'}`;
const palette = ['#F0B65E', '#51C2B8', '#819DFA', '#E78DAE', '#A5B2C4'];
function dataset(counts: number[], uncategorizedCount = 0) {
  const categories: CategoryResponse[] = counts.map((_, i) => ({
    id: fixtureId(`chart191-${i}`),
    name: `카테고리 ${i + 1}`,
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
type Data = ReturnType<typeof dataset>;
function actualCollision(): Data {
  const state = initialProduct();
  return {
    categories: state.categories,
    summary: {
      items: state.categories.map((c) => ({
        id: c.id,
        linkCount: state.links.filter((l) => l.categoryId === c.id).length,
      })),
      uncategorizedCount: 0,
      totalLinkCount: state.links.length,
    },
  };
}
function result(data: Data) {
  const r = categoryDistribution(data.summary, data.categories);
  if (r.status !== 'ready') throw Error(r.status);
  return r.items;
}
function unique(data: Data) {
  const items = result(data);
  const ordinary = items.filter(
    (i) => i.id !== 'other' && i.id !== 'uncategorized',
  );
  expect(new Set(ordinary.map((i) => i.color)).size).toBe(ordinary.length);
  for (const i of ordinary) expect(palette).toContain(i.color);
  expect(items.reduce((a, b) => a + b.count, 0)).toBe(
    data.summary.totalLinkCount,
  );
  expect(items.length).toBeLessThanOrEqual(6);
  return items;
}
async function install(page: Page, data: Data) {
  const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };
  await page.route('**/categories', (r) =>
    r.fulfill({ headers, json: data.categories }),
  );
  await page.route('**/categories/summary', (r) =>
    r.fulfill({ headers, json: data.summary }),
  );
}
async function capture(page: Page, name: string) {
  const dir = `${root}/${page.context().browser()?.browserType().name()}`;
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}
const list = (page: Page) =>
  page.getByRole('list', { name: '카테고리별 링크 수' });
const center = (page: Page) => page.getByTestId('donut-center');
const paths = (page: Page) => page.locator('path[data-category-id]');
for (const [name, data, width] of [
  ['real-collision', actualCollision(), 1440],
  ['five', dataset([40, 30, 20, 15, 10]), 1440],
  ['six-exception', dataset([6, 5, 4, 3, 2, 1]), 1440],
  ['four-reserved', dataset([40, 30, 20, 15, 10, 8, 7], 5), 1440],
  ['five-other', dataset([40, 30, 20, 15, 10, 8, 7]), 1440],
  ['mobile-390', dataset([40, 30, 20, 15, 10, 8, 7], 5), 390],
  ['mobile-320', dataset([40, 30, 20, 15, 10, 8, 7], 5), 320],
  ['tiny', dataset([9999, 1]), 390],
  ['zero', dataset([]), 390],
] as const)
  test(`capture 19.1 ${name}`, async ({ page }) => {
    await install(page, data);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/settings');
    await expect(center(page)).toHaveText(
      `${data.summary.totalLinkCount.toLocaleString('ko-KR')}전체 링크`,
    );
    await expectAccountVerified(page);
    await capture(page, name);
    if (!before) {
      const expected = unique(data);
      await expect(paths(page)).toHaveCount(expected.length);
      for (const item of expected)
        await expect(
          page.locator(`path[data-category-id="${item.id}"]`),
        ).toHaveAttribute('fill', item.color);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  });
for (const count of [0, 1, 2, 3, 4, 5, 6, 7, 20, 50])
  for (const unc of [0, 5])
    test(`unique colors ${count} ordinary and reserved ${unc}`, () => {
      const data = dataset(
        Array.from({ length: count }, (_, i) => count - i),
        unc,
      );
      const original = JSON.stringify(data);
      const items = unique(data);
      expect(JSON.stringify(data)).toBe(original);
      if (unc)
        expect(items.find((i) => i.id === 'uncategorized')?.color).toBe(
          '#D0C9BB',
        );
      if (items.some((i) => i.id === 'other'))
        expect(items.find((i) => i.id === 'other')?.color).toBe('#7B818D');
      if (count === 6 && unc === 0) {
        expect(items.slice(0, 5).map((i) => i.count)).toEqual([6, 5, 4, 3, 2]);
        expect(items.at(-1)?.id).toBe('other');
        expect(items.at(-1)?.count).toBe(1);
      }
    });
test('real design/productivity preferred colors collide but assigned colors differ', () => {
  const data = actualCollision();
  const design = data.categories.find((c) => c.name === '디자인')!;
  const productivity = data.categories.find((c) => c.name === '생산성')!;
  expect(categoryColor(design.id)).toBe(categoryColor(productivity.id));
  const items = unique(data);
  expect(items.find((i) => i.id === design.id)?.color).not.toBe(
    items.find((i) => i.id === productivity.id)?.color,
  );
});
test('same displayed set is stable across names, management order, counts, ranking and API order', () => {
  const data = dataset([5, 4, 3, 2, 1]);
  const colors = new Map(unique(data).map((i) => [i.id, i.color]));
  data.categories.reverse().forEach((c, i) => {
    c.name = `바뀐 이름 ${i}`;
    c.sortOrder = 9 - i;
  });
  data.summary.items.reverse().forEach((item, i) => {
    item.linkCount = 5 - i;
  });
  for (const item of unique(data)) expect(item.color).toBe(colors.get(item.id));
  data.categories.forEach((c) => (c.id = c.id.toUpperCase()));
  data.summary.items.forEach((i) => (i.id = i.id.toUpperCase()));
  for (const item of unique(data)) expect(item.color).toBe(colors.get(item.id));
});
test('display set changes, grouping and ungrouping keep uniqueness and exact values', () => {
  const data = dataset([50, 40, 30, 20, 10, 5, 1], 2);
  for (const counts of [
    [50, 40, 30, 20, 10, 5, 1],
    [1, 40, 30, 20, 10, 5, 50],
    [50, 40, 30, 20, 0, 0, 0],
    [1, 2, 3, 4, 5, 6, 7],
  ]) {
    data.summary.items.forEach((item, i) => (item.linkCount = counts[i]!));
    data.summary.totalLinkCount = counts.reduce((a, b) => a + b, 2);
    unique(data);
  }
});
test('all preferred hash collisions probe deterministically across the entire palette', () => {
  const pool = dataset(Array.from({ length: 100 }, () => 1));
  const color = categoryColor(pool.categories[0]!.id);
  const cats = pool.categories
    .filter((c) => categoryColor(c.id) === color)
    .slice(0, 5);
  const data: Data = {
    categories: cats,
    summary: {
      items: cats.map((c) => ({ id: c.id, linkCount: 1 })),
      uncategorizedCount: 0,
      totalLinkCount: 5,
    },
  };
  expect(cats).toHaveLength(5);
  expect(new Set(unique(data).map((i) => i.color))).toEqual(new Set(palette));
  expect(
    new Map(
      result({ ...data, categories: [...cats].reverse() }).map((i) => [
        i.id,
        i.color,
      ]),
    ),
  ).toEqual(new Map(result(data).map((i) => [i.id, i.color])));
});
test('capture 19.1 emphasis priority, selection, reset and reserved groups', async ({
  page,
}) => {
  const data = dataset([40, 30, 20, 15, 10, 8, 7], 5);
  await install(page, data);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/settings');
  await expect(paths(page)).toHaveCount(6);
  await page.mouse.move(0, 0);
  for (const p of await paths(page).all())
    await expect(p).toHaveAttribute('opacity', '1');
  await capture(page, 'default');
  const first = list(page).getByRole('button', { name: /^카테고리 1 / });
  await first.click();
  await page.mouse.move(0, 0);
  await expect(center(page)).toHaveText('40카테고리 129.6%');
  await capture(page, 'selected');
  if (!before) {
    await expect(paths(page).first()).toHaveAttribute('opacity', '1');
    await expect(paths(page).nth(1)).toHaveAttribute('opacity', '0.8');
    await expect(paths(page).first()).toHaveAttribute(
      'stroke',
      'var(--foreground)',
    );
  }
  await list(page)
    .getByRole('button', { name: /^미분류/ })
    .hover();
  await expect(center(page)).toHaveText('40카테고리 129.6%');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await capture(page, 'selected-with-hover');
  if (!before) {
    await expect(
      page.locator('path[data-category-id="uncategorized"]'),
    ).toHaveAttribute('opacity', '1');
    await expect(paths(page).first()).toHaveAttribute('opacity', '0.8');
  }
  await page.mouse.move(0, 0);
  if (!before)
    await expect(paths(page).first()).toHaveAttribute('opacity', '1');
  await list(page).getByRole('button', { name: /^기타/ }).click();
  await page.mouse.move(0, 0);
  await expect(center(page)).toHaveText('25기타18.5%');
  await capture(page, 'other-selected');
  await list(page)
    .getByRole('button', { name: /^미분류/ })
    .focus();
  await page.keyboard.press('Enter');
  await expect(center(page)).toHaveText('5미분류3.7%');
  await capture(page, 'uncategorized-selected');
  await page.keyboard.press('Space');
  await expect(center(page)).toHaveText('135전체 링크');
  await first.click();
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(center(page)).toHaveText('135전체 링크');
  for (const p of await paths(page).all())
    await expect(p).toHaveAttribute('opacity', '1');
});
test('contrast in default and faded state against actual surface', async ({
  page,
}) => {
  await page.goto('/settings');
  const chart = page.getByTestId('category-distribution');
  await expect(chart).toBeVisible();
  const surface = await chart.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(surface).toBe('rgb(31, 32, 34)');
  const bg = [31, 32, 34];
  const lum = (rgb: number[]) =>
    rgb
      .map((n) => n / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((a, b, i) => a + b * [0.2126, 0.7152, 0.0722][i]!, 0);
  const rows = [...palette, '#D0C9BB', '#7B818D'].map((color) => {
    const rgb = color.match(/[0-9a-f]{2}/gi)!.map((v) => parseInt(v, 16));
    const ratio = (alpha: number) =>
      (lum(rgb.map((v, i) => v * alpha + bg[i]! * (1 - alpha))) + 0.05) /
      (lum(bg) + 0.05);
    return { color, normal: ratio(1), dimmed: ratio(0.8) };
  });
  for (const row of rows) {
    expect(row.normal).toBeGreaterThanOrEqual(3);
    expect(row.dimmed).toBeGreaterThanOrEqual(3);
  }
  await mkdir('artifacts/wo-ui-19-1', { recursive: true });
  await writeFile(
    'artifacts/wo-ui-19-1/contrast.json',
    JSON.stringify(
      {
        surface,
        rows,
        note: 'Fill vs surface only; not pairwise color contrast or blanket accessibility certification.',
      },
      null,
      2,
    ),
  );
});

test('visible selected UUID survives a changed top set and grouping removal', async ({
  page,
}) => {
  const data = dataset([40, 30, 20, 15, 10, 8, 7], 5);
  await install(page, data);
  await page.clock.install();
  await page.goto('/settings');
  const selected = list(page).getByRole('button', { name: /^카테고리 1 / });
  await selected.click();
  await page.mouse.move(0, 0);
  async function refresh() {
    await page.clock.fastForward(16000);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
  }
  data.summary.items[6]!.linkCount = 60;
  data.summary.totalLinkCount = 188;
  await refresh();
  await expect(center(page)).toHaveText('40카테고리 121.3%');
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  for (const item of unique(data))
    await expect(
      page.locator(`path[data-category-id="${item.id}"]`),
    ).toHaveAttribute('fill', item.color);
  // Change the visible set through zero counts while keeping the same API ID set.
  // Removing metadata concurrently can legitimately unmount the chart on snapshot mismatch.
  data.summary.items.forEach((item, index) => {
    if (index >= 5) item.linkCount = 0;
  });
  data.summary.uncategorizedCount = 0;
  data.summary.totalLinkCount = 115;
  await refresh();
  await expect(center(page)).toHaveText('40카테고리 134.8%');
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('path[data-category-id="other"]')).toHaveCount(0);
  for (const item of unique(data))
    await expect(
      page.locator(`path[data-category-id="${item.id}"]`),
    ).toHaveAttribute('fill', item.color);
});
