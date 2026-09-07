import type { Page } from '@playwright/test';
export async function openCategoryCreate(page: Page) {
  await page
    .getByRole('button', { name: '카테고리 추가', exact: true })
    .click();
}
export async function categoryMenu(
  page: Page,
  name: string,
  action: '이름 변경' | '삭제',
) {
  await page.getByRole('button', { name: `${name} 관리`, exact: true }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}
