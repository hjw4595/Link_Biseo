import type { Page } from '@playwright/test';

export async function editLinkInfo(page: Page) {
  await page.getByRole('button', { name: '정보 수정', exact: true }).click();
}
export async function requestLinkDeletion(page: Page) {
  await page.getByRole('button', { name: '삭제', exact: true }).click();
}
