import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import { validPresetMembers } from '../src/contracts/quick-launch';

const root = 'artifacts/wo-ui-04/management';
async function shot(page: Page, name: string) {
  await mkdir(root, { recursive: true });
  await page.screenshot({
    path: `${root}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}
async function edit(page: Page) {
  await page
    .getByRole('button', { name: '업무 1 펼치기', exact: true })
    .click();
  await page.getByRole('button', { name: '편집', exact: true }).click();
}
test('member validation preserves legacy subsets without capacity bypass', () => {
  const old = Array.from({ length: 12 }, (_, i) => `id-${i}`);
  expect(validPresetMembers(old)).toBe(false);
  expect(validPresetMembers(old.toReversed(), old)).toBe(true);
  expect(validPresetMembers(old.slice(0, 9), old)).toBe(true);
  expect(validPresetMembers([...old.slice(0, 7), 'new'], old)).toBe(false);
  expect(validPresetMembers(old.slice(0, 9), old.slice(0, 8))).toBe(false);
  expect(validPresetMembers(['a', 'a'])).toBe(false);
});
for (const width of [390, 768, 1023, 1024, 1280, 1440, 1920])
  test(`management card layout ${width}`, async ({ page }) => {
    await presetApi(page, 8, 3);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('link-item')).toHaveCount(3);
    if (width >= 1024) {
      const card = page.getByRole('listitem', {
        name: '빠른 실행 업무 1',
        exact: true,
      });
      const toggle = card.getByRole('button', {
        name: '업무 1 펼치기',
        exact: true,
      });
      await expect(toggle).toHaveText('링크 3개');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await card.getByRole('heading', { name: '업무 1', exact: true }).click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await shot(page, `cards-${width}`);
      await toggle.focus();
      await page.keyboard.press('Space');
      await expect(
        card.getByRole('button', { name: '업무 1 접기', exact: true }),
      ).toHaveAttribute('aria-expanded', 'true');
      const list = card.getByRole('list');
      await expect(list.getByRole('link')).toHaveCount(3);
      expect(await list.evaluate((e) => e.scrollHeight <= e.clientHeight)).toBe(
        true,
      );
      await shot(page, `expanded-3-${width}`);
      await card.getByRole('button', { name: '편집', exact: true }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();
      await expect
        .poll(async () => {
          const rect = await sheet.boundingBox();
          return Math.round(rect!.x + rect!.width);
        })
        .toBe(width);
      await shot(page, `editor-${width}`);
      await page
        .getByRole('button', { name: '+ 링크 추가', exact: true })
        .click();
      await expect(page.getByRole('button', { name: /추가됨$/ })).toHaveCount(
        3,
      );
      await shot(page, `picker-${width}`);
    } else {
      await expect(
        page.getByRole('region', { name: '빠른 실행', exact: true }),
      ).toHaveCount(0);
      await shot(page, `home-${width}`);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test('server search and category AND, uncategorized, draft persistence and distinct empty/error states', async ({
  page,
  context,
}) => {
  const product = await installProductApi(context);
  const presets = await presetApi(page, 1, 0);
  const category = initialProduct().categories[0]!;
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '빠른 실행 추가', exact: true }),
  ).toBeVisible();
  for (const state of product.users.values()) {
    const seed = state.links[0]!;
    state.links = Array.from({ length: 30 }, (_, i) => ({
      ...seed,
      id: fixtureId(`picker-${i}`),
      title: `검색 링크 ${i}`,
      url: `https://example.com/picker-${i}`,
      categoryId: i === 29 ? category.id : null,
      isFavorite: false,
    }));
  }
  await edit(page);
  await page.getByRole('button', { name: '+ 링크 추가', exact: true }).click();
  const list = page.getByRole('list', { name: '등록된 링크 선택' });
  await expect(list.getByRole('listitem')).toHaveCount(20);
  await page
    .getByRole('searchbox', { name: '포함할 링크 검색' })
    .fill('picker-29');
  await page.getByLabel('카테고리 필터').selectOption(category.id);
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await page
    .getByRole('button', { name: '검색 링크 29 추가', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '검색 링크 29 추가됨', exact: true }),
  ).toBeDisabled();
  expect(
    product.requests.some((r) => {
      const u = new URL(r.url());
      return (
        u.searchParams.get('q') === 'picker-29' &&
        u.searchParams.get('categoryId') === category.id
      );
    }),
  ).toBe(true);
  await shot(page, 'category-filter');
  await page.getByLabel('카테고리 필터').selectOption('uncategorized');
  await expect(page.getByText('조건에 맞는 링크가 없어요.')).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await expect(list.getByRole('listitem')).toHaveCount(20);
  await page.getByRole('button', { name: /^선택 완료/ }).click();
  await expect(
    page.getByRole('list', { name: '선택한 링크 순서' }).getByRole('listitem'),
  ).toHaveCount(1);
  expect(presets.requests.every((r) => r.method === 'GET')).toBe(true);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(
    page.getByText('저장하지 않은 변경사항을 버릴까요?'),
  ).toBeVisible();
  await page.getByRole('button', { name: '계속 편집', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '선택한 링크 순서' }).getByRole('listitem'),
  ).toHaveCount(1);
  await page.getByRole('button', { name: '+ 링크 추가', exact: true }).click();
  await page.route('**/links?**', (route) =>
    route.fulfill({ status: 500, json: {} }),
  );
  await page.getByRole('searchbox').fill('failure');
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: /^선택 완료/ }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page
    .getByRole('button', { name: '변경사항 버리기', exact: true })
    .click();
  expect(presets.requests.every((r) => r.method === 'GET')).toBe(true);
});
for (const size of [8, 12])
  test(`full ${size} member list, legacy edit/reorder/remove and no source delete`, async ({
    page,
  }) => {
    const api = await presetApi(page, 1, 0),
      seed = initialProduct().links[0]!;
    api.items[0]!.links = Array.from({ length: size }, (_, i) => ({
      sortOrder: i,
      link: { ...seed, id: fixtureId(`legacy-${i}`), title: `원본 ${i}` },
    }));
    api.items[0]!.linkCount = size;
    const original = api.items[0]!.links.map((r) => r.link.id);
    const sourceDeletes: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'DELETE' && r.url().includes('/links/'))
        sourceDeletes.push(r.url());
    });
    await page.goto('/');
    await page
      .getByRole('button', { name: '업무 1 펼치기', exact: true })
      .click();
    const list = page.getByRole('list', { name: '업무 1 포함 링크' });
    await expect(list.getByRole('link')).toHaveCount(size);
    expect(await list.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(
      size > 8,
    );
    await shot(page, `expanded-${size}`);
    await page.getByRole('button', { name: '편집', exact: true }).click();
    await page
      .getByRole('button', { name: '+ 링크 추가', exact: true })
      .click();
    for (const button of await page
      .getByRole('list', { name: '등록된 링크 선택' })
      .getByRole('button')
      .all())
      await expect(button).toBeDisabled();
    await shot(page, `selected-${size}`);
    await page.getByRole('button', { name: /^선택 완료/ }).click();
    await page.getByLabel('이름', { exact: true }).fill('기존 묶음 수정');
    await page
      .getByRole('button', { name: '원본 0 아래로 이동', exact: true })
      .click();
    await page
      .getByRole('button', {
        name: `원본 ${size - 1} 포함된 링크에서 제거`,
        exact: true,
      })
      .click();
    expect(api.requests.every((r) => r.method === 'GET')).toBe(true);
    await page.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(api.items[0]!.links.map((r) => r.link.id)).toEqual([
      original[1],
      original[0],
      ...original.slice(2, -1),
    ]);
    expect(sourceDeletes).toEqual([]);
  });
