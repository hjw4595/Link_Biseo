import { expectAccountVerified } from './account-assertions';
import { mkdir } from 'node:fs/promises';
import { test, expect, testUser, authenticate } from './auth-fixture';
const before = process.env.WO_UI_21_CAPTURE === 'before';
const root = `artifacts/wo-ui-21/${before ? 'before' : 'after'}`;
for (const width of [320, 390, 768, 1024, 1440])
  test(`settings user-facing capture ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/settings');
    await expect(
      page.getByLabel('미사용 링크 추천 기간', { exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole('region', { name: '계정', exact: true }),
    ).toContainText(testUser.email);
    // Wait for the account transport itself, not a developer-only success label.
    await expect
      .poll(async () => {
        const request = (await page.requests())
          .filter((r) => new URL(r.url()).pathname === '/auth/me')
          .at(-1);
        return (await request?.response())?.status();
      })
      .toBe(200);
    await mkdir(root, { recursive: true });
    await page.screenshot({
      path: `${root}/settings-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    if (before) return;
    await expect(
      page.getByText(/API 사용자 확인 완료|API 연결 진단|Supabase 계정/),
    ).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'API 연결 진단' })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const account = page.getByRole('region', { name: '계정', exact: true });
    expect((await account.boundingBox())!.height).toBeLessThan(180);
    const logout = page.getByRole('button', { name: '로그아웃', exact: true });
    await logout.scrollIntoViewIfNeeded();
    const nav = await page.getByRole('navigation').boundingBox();
    const box = await logout.boundingBox();
    if (width < 1024) expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y);
    await page.screenshot({
      path: `${root}/bottom-${width}.png`,
      animations: 'disabled',
    });
  });

for (const provider of ['valid', 'email'])
  test(`quiet verified ${provider} account keeps authenticated GET and profile`, async ({
    page,
    context,
  }) => {
    await authenticate(context, false, provider);
    const requests: string[] = [];
    await page.route('**/auth/me', async (route) => {
      requests.push(route.request().headers().authorization ?? '');
      await route.continue();
    });
    await page.goto('/settings');
    await expectAccountVerified(page);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(/^Bearer /);
    const account = page.getByRole('region', { name: '계정', exact: true });
    await expect(account).toContainText(testUser.email);
    await expect(account.getByLabel('계정 연결 수단')).toHaveText(
      provider === 'email' ? '이메일' : 'Google',
    );
    await expect(
      account.getByText(provider === 'email' ? '내 계정' : '테스트 사용자', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(account.getByText(/API|Supabase/)).toHaveCount(0);
    await expect(
      page.getByLabel('미사용 링크 추천 기간', { exact: true }),
    ).toHaveValue('14');
  });
for (const width of [320, 1440])
  test(`account error retry locks duplicate dispatch and recovers at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let calls = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/auth/me', async (route) => {
      calls++;
      if (calls === 1) {
        await route.fulfill({
          status: 503,
          json: { message: 'internal endpoint exception' },
        });
        return;
      }
      await gate;
      await route.continue();
    });
    await page.goto('/settings');
    const account = page.getByRole('region', { name: '계정', exact: true });
    await expect(account.getByRole('alert')).toHaveText(
      '계정 정보를 확인하지 못했어요.',
    );
    await expect(account).toContainText(testUser.email);
    await expect(
      account.getByText(/API|Supabase|internal endpoint/),
    ).toHaveCount(0);
    await expect(
      page.getByLabel('미사용 링크 추천 기간', { exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId('donut-center')).toHaveText('8전체 링크');
    const original = await account.boundingBox();
    await mkdir(root, { recursive: true });
    await page.screenshot({
      path: `${root}/account-error-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    const retry = account.getByRole('button', {
      name: '다시 시도',
      exact: true,
    });
    await retry.click();
    await expect.poll(() => calls).toBe(2);
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveAttribute('aria-busy', 'true');
    await retry.evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(calls).toBe(2);
    await expect(account).toContainText(testUser.email);
    release();
    await expectAccountVerified(page);
    expect(calls).toBe(2);
    expect((await account.boundingBox())!.height).toBeLessThan(
      original!.height,
    );
    await page.screenshot({
      path: `${root}/retry-success-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    const select = page.getByLabel('미사용 링크 추천 기간', { exact: true });
    await select.selectOption('7');
    await expect(select).toBeEnabled();
    await expect(select).toHaveValue('7');
    await page
      .getByRole('list', { name: '카테고리별 링크 수' })
      .getByRole('button')
      .first()
      .click();
    await expect(
      page
        .getByRole('list', { name: '카테고리별 링크 수' })
        .locator('[aria-pressed=true]'),
    ).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
test('initial account verification stays quiet and direct diagnostics retains health retry', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/auth/me', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/settings');
  const account = page.getByRole('region', { name: '계정', exact: true });
  await expect(account.getByRole('status')).toHaveText(
    '계정 정보를 확인하고 있어요.',
  );
  await expect(account).toContainText(testUser.email);
  await expect(account.getByRole('status')).toHaveClass(/sr-only/);
  await expect(account.getByRole('button')).toHaveCount(0);
  release();
  await expectAccountVerified(page);
  await expect(page.getByRole('link', { name: 'API 연결 진단' })).toHaveCount(
    0,
  );
  await page.route('**/health', (route) => route.abort());
  await page.goto('/diagnostics');
  await expect(
    page.getByRole('heading', { name: 'Foundation 상태' }),
  ).toBeVisible();
  await expect(page.getByText('Unavailable', { exact: true })).toBeVisible();
  await page.unroute('**/health');
  await page.route('**/health', (route) =>
    route.fulfill({ json: { status: 'ok' } }),
  );
  await page.getByRole('button', { name: '다시 확인', exact: true }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
});
