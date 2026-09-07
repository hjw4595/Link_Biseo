import { test, expect } from './auth-fixture';
import { isCategoryResponse, type CategoryResponse } from '../src/contracts';

import { openCategoryCreate, categoryMenu } from './category-ui';

const api = 'http://127.0.0.1:54329/categories';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row: CategoryResponse = {
  id,
  name: '개발',
  sortOrder: 0,
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
};
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3100' };

test('Category runtime response contracts reject invalid data', () => {
  expect(isCategoryResponse(row)).toBe(true);
  for (const bad of [
    null,
    {},
    { ...row, id: 'invalid' },
    { ...row, name: null },
    { ...row, sortOrder: '0' },
    { ...row, sortOrder: 2147483648 },
    { ...row, createdAt: 'invalid' },
    { ...row, updatedAt: null },
  ])
    expect(isCategoryResponse(bad)).toBe(false);
});

test('Category CRUD attaches the session token and survives reload', async ({
  page,
}) => {
  let rows: CategoryResponse[] = [];
  await page.route(
    new RegExp('^' + api + '(?:/[0-9a-f-]+)?$'),
    async (route) => {
      const request = route.request();
      expect(request.headers().authorization).toMatch(/^Bearer /);
      const method = request.method();
      const path = new URL(request.url()).pathname;
      if (method === 'GET') return route.fulfill({ json: rows, headers: cors });
      if (method === 'DELETE') {
        expect(path).toBe(`/categories/${id}`);
        rows = [];
        return route.fulfill({ status: 204, headers: cors });
      }
      const body: unknown = request.postDataJSON();
      expect(body).not.toHaveProperty('userId');
      expect(body).not.toHaveProperty('user_id');
      if (
        typeof body !== 'object' ||
        body === null ||
        !('name' in body) ||
        typeof body.name !== 'string' ||
        ('sortOrder' in body && typeof body.sortOrder !== 'number')
      )
        throw new Error('Invalid category test request');
      rows = [
        {
          ...row,
          name: body.name,
          sortOrder:
            'sortOrder' in body && typeof body.sortOrder === 'number'
              ? body.sortOrder
              : (rows[0]?.sortOrder ?? 0),
        },
      ];
      return route.fulfill({
        status: method === 'POST' ? 201 : 200,
        json: rows[0],
        headers: cors,
      });
    },
  );
  await page.goto('/categories');
  await expect(page.getByText('아직 카테고리가 없어요.')).toBeVisible();
  await openCategoryCreate(page);
  await page.getByLabel('카테고리 이름', { exact: true }).fill('개발');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }),
  ).toContainText('개발');
  await page.reload();
  await expect(
    page.getByRole('button', { name: '개발 관리', exact: true }),
  ).toBeVisible();
  await categoryMenu(page, '개발', '이름 변경');
  await page.getByLabel('카테고리 이름', { exact: true }).fill('프론트엔드');
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '프론트엔드 관리', exact: true }),
  ).toBeVisible();
  await categoryMenu(page, '프론트엔드', '삭제');
  await page
    .getByRole('button', { name: '카테고리 삭제', exact: true })
    .click();
  await expect(page.getByText('아직 카테고리가 없어요.')).toBeVisible();
});

test('duplicate names show 409 without losing the entered name', async ({
  page,
}) => {
  await page.route(new RegExp('^' + api + '(?:/[0-9a-f-]+)?$'), (route) =>
    route.fulfill({
      status: route.request().method() === 'GET' ? 200 : 409,
      json: route.request().method() === 'GET' ? [row] : {},
      headers: cors,
    }),
  );
  await page.goto('/categories');
  await expect(
    page.getByRole('button', { name: '개발 관리', exact: true }),
  ).toBeVisible();
  await openCategoryCreate(page);
  await page.getByLabel('카테고리 이름', { exact: true }).fill('개발');
  await expect(
    page.getByRole('button', { name: '추가', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '같은 이름',
  );
  await expect(page.getByLabel('카테고리 이름', { exact: true })).toHaveValue(
    '개발',
  );
});

test('expired API credentials refresh once before listing', async ({
  page,
}) => {
  let calls = 0;
  await page.route(new RegExp('^' + api + '(?:/[0-9a-f-]+)?$'), (route) => {
    calls++;
    return route.fulfill({
      status: calls === 1 ? 401 : 200,
      json: calls === 1 ? {} : [],
      headers: cors,
    });
  });
  await page.goto('/categories');
  await expect(page.getByText('아직 카테고리가 없어요.')).toBeVisible();
  expect(calls).toBe(2);
});

test('continued 401 stops retrying and asks to sign in', async ({ page }) => {
  let calls = 0;
  await page.route(new RegExp('^' + api + '(?:/[0-9a-f-]+)?$'), (route) => {
    calls++;
    return route.fulfill({ status: 401, json: {}, headers: cors });
  });
  await page.goto('/categories');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '다시 로그인',
  );
  expect(calls).toBe(2);
});

test('network/service failure can retry without demo fallback', async ({
  page,
}) => {
  let calls = 0;
  await page.route(new RegExp('^' + api + '(?:/[0-9a-f-]+)?$'), (route) => {
    calls++;
    return route.fulfill({
      status: calls === 1 ? 503 : 200,
      json: calls === 1 ? {} : [row],
      headers: cors,
    });
  });
  await page.goto('/categories');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '잠시 처리하지 못했어요',
  );
  await expect(page.getByRole('list', { name: '저장된 카테고리' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(
    page.getByRole('button', { name: '개발 관리', exact: true }),
  ).toBeVisible();
});

test('invalid responses are rejected and mobile layout does not overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route(new RegExp('^' + api + '(?:/[0-9a-f-]+)?$'), (route) =>
    route.fulfill({ json: { status: 'ok' }, headers: cors }),
  );
  await page.goto('/categories');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '카테고리 응답',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('a failed write is not automatically retried or shown as saved', async ({
  page,
}) => {
  let writes = 0;
  await page.route(new RegExp('^' + api + '(?:/[0-9a-f-]+)?$'), (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: [], headers: cors });
    writes++;
    return route.abort();
  });
  await page.goto('/categories');
  await expect(page.getByText('아직 카테고리가 없어요.')).toBeVisible();
  await openCategoryCreate(page);
  await page
    .getByLabel('카테고리 이름', { exact: true })
    .fill('네트워크 테스트');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '네트워크',
  );
  expect(writes).toBe(1);
  await expect(
    page.getByRole('button', { name: '네트워크 테스트 관리' }),
  ).toHaveCount(0);
});
