import { expect, type Page } from '@playwright/test';
/** Successful account transport + quiet profile UI replace the removed developer label. */
export async function expectAccountVerified(page: Page) {
  const account = page.getByRole('region', { name: '계정', exact: true });
  await expect(account).toBeVisible();
  await expect
    .poll(async () => {
      const request = (await page.requests())
        .filter((request) => new URL(request.url()).pathname === '/auth/me')
        .at(-1);
      const response = await request?.response();
      if (!response || response.status() !== 200) return false;
      try {
        const body: unknown = await response.json();
        return (
          typeof body === 'object' &&
          body !== null &&
          'id' in body &&
          typeof body.id === 'string'
        );
      } catch {
        return false;
      }
    })
    .toBe(true);
  await expect(account.getByRole('status')).toHaveCount(0);
  await expect(account.getByRole('alert')).toHaveCount(0);
  await expect(
    account.getByRole('button', { name: '다시 시도', exact: true }),
  ).toHaveCount(0);
  await expect(
    account.getByText(/API 사용자 확인 완료|Supabase 계정/),
  ).toHaveCount(0);
}
