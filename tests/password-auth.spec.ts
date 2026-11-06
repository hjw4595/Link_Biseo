import { expectAccountVerified } from './account-assertions';
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { authenticate, testSession, testUser } from './auth-fixture';
import { installProductApi } from './product-fixture';

test.beforeEach(async ({ context }) => {
  await installProductApi(context);
});

async function fillLogin(page: Page, password: string, alternate = false) {
  await page
    .getByLabel('이메일', { exact: true })
    .fill(alternate ? 'second@example.test' : `  ${testUser.email}  `);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
}

// Only the HTTP response is simulated. The real Supabase SDK writes SSR cookies;
// server guards, getUser, AuthProvider and the API client run unchanged.
async function mockPassword(page: Page) {
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    const body: unknown = route.request().postDataJSON();
    const alternate =
      typeof body === 'object' &&
      body !== null &&
      'email' in body &&
      body.email === 'second@example.test';
    await route.fulfill({
      json: testSession(false, alternate ? 'email-alternate' : 'email'),
    });
  });
}

test('validation prevents requests and identifies the field without changing the password', async ({
  page,
}) => {
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().includes('grant_type=password')) requests++;
  });
  await page.goto('/login');
  const submit = page.getByRole('button', {
    name: '이메일로 로그인',
    exact: true,
  });
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveAttribute(
    'type',
    'password',
  );
  await submit.click();
  await expect(page.getByLabel('이메일', { exact: true })).toBeFocused();
  await page.getByLabel('이메일', { exact: true }).fill('invalid');
  await submit.click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    '올바른 이메일을 입력해주세요.',
  );
  await page.getByLabel('이메일', { exact: true }).fill(testUser.email);
  for (const value of ['', '   ']) {
    await page.getByLabel('비밀번호', { exact: true }).fill(value);
    await submit.click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      '비밀번호를 입력해주세요.',
    );
    await expect(page.getByLabel('비밀번호', { exact: true })).toBeFocused();
  }
  expect(requests).toBe(0);
});

test('Enter, pending lock, unchanged password, verified API, reload, focus and logout', async ({
  page,
  context,
}) => {
  const password = ` ${randomUUID()} `;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toMatchObject({
      email: testUser.email,
      password,
    });
    await gate;
    await route.fulfill({ json: testSession(false, 'email') });
  });
  const logs: string[] = [];
  page.on('console', (message) => logs.push(message.text()));
  await page.goto('/settings');
  await fillLogin(page, password);
  await page.getByLabel('비밀번호', { exact: true }).press('Enter');
  await expect(
    page.getByRole('button', { name: '로그인 중…' }),
  ).toHaveAttribute('aria-busy', 'true');
  await expect(
    page.getByRole('button', { name: 'Google로 계속하기' }),
  ).toBeDisabled();
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  expect(calls).toBe(1);
  release();
  await expect(page).toHaveURL('/settings');
  await expectAccountVerified(page);
  await expect(page.getByText('내 계정', { exact: true })).toBeVisible();
  await page.reload();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(testUser.email, { exact: true })).toBeVisible();
  expect(JSON.stringify(await context.storageState())).not.toContain(password);
  expect(
    await page.evaluate(() => JSON.stringify({ ...sessionStorage })),
  ).not.toContain(password);
  expect(page.url()).not.toContain(encodeURIComponent(password));
  expect(logs.join('\n')).not.toContain(password);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login/);
});

for (const failure of [
  'credentials',
  'unconfirmed',
  'limited',
  'server',
  'network',
]) {
  test(`password ${failure} is private and retryable`, async ({ page }) => {
    await page.route('**/auth/v1/token?grant_type=password', (route) =>
      failure === 'network'
        ? route.abort()
        : route.fulfill({
            status:
              failure === 'limited' ? 429 : failure === 'server' ? 503 : 400,
            json: {
              code:
                failure === 'unconfirmed'
                  ? 'email_not_confirmed'
                  : 'invalid_credentials',
              message: 'PRIVATE provider detail',
            },
          }),
    );
    await page.goto('/login');
    await fillLogin(page, randomUUID());
    await page
      .getByRole('button', { name: '이메일로 로그인', exact: true })
      .click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      ['credentials', 'unconfirmed'].includes(failure)
        ? '이메일 또는 비밀번호를 확인해주세요.'
        : '로그인에 실패했어요. 잠시 후 다시 시도해주세요.',
    );
    await expect(
      page.getByRole('button', { name: 'Google로 계속하기' }),
    ).toBeEnabled();
    await mockPassword(page);
    await page
      .getByRole('button', { name: '이메일로 로그인', exact: true })
      .click();
    await expect(page).toHaveURL('/');
  });
}

test('email A, email B and Google use identity-scoped product data', async ({
  page,
}) => {
  await mockPassword(page);
  await page.goto('/login?next=/categories');
  const password = randomUUID();
  await fillLogin(page, password);
  await page
    .getByRole('button', { name: '이메일로 로그인', exact: true })
    .click();
  await expect(page).toHaveURL('/categories');
  await page.goto('/categories?action=create');
  await page
    .getByLabel('카테고리 이름', { exact: true })
    .fill('A 전용 카테고리');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }),
  ).toContainText('A 전용 카테고리');
  // A changes server state; B must see its own initial state, including links.
  await page.goto('/category/32e83e92-d45d-41f6-8dcf-9d214688f037');
  const favorite = page.getByRole('button', {
    name: 'Claude 즐겨찾기',
    exact: true,
  });
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/settings');
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL('/login');
  // Logout performs a full navigation. URL commit precedes the new document's
  // scripts; match page.goto's load boundary before entering the next account.
  await page.waitForLoadState('load');
  await fillLogin(page, password, true);
  await page
    .getByRole('button', { name: '이메일로 로그인', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  await page.goto('/categories');
  await expect(
    page.getByRole('list', { name: '저장된 카테고리' }),
  ).not.toContainText('A 전용 카테고리');
  await page.goto('/category/32e83e92-d45d-41f6-8dcf-9d214688f037');
  await expect(favorite).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/settings');
  await expect(
    page.getByText('second@example.test', { exact: true }),
  ).toBeVisible();
  await expectAccountVerified(page);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: 'Google로 계속하기' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/category/32e83e92-d45d-41f6-8dcf-9d214688f037');
  // The Google fixture shares A's user ID. Provider changes must not change ownership.
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
});

test('password redirect rejects an external destination', async ({ page }) => {
  await mockPassword(page);
  await page.goto('/login?next=https://evil.test');
  await fillLogin(page, randomUUID());
  await page
    .getByRole('button', { name: '이메일로 로그인', exact: true })
    .click();
  await expect(page).toHaveURL('/');
});

test('email session refresh preserves the verified user and API identity', async ({
  page,
  context,
}) => {
  await authenticate(context, true, 'email-alternate');
  await page.goto('/settings');
  await expect(
    page.getByText('second@example.test', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('내 계정', { exact: true })).toBeVisible();
  await expectAccountVerified(page);
  await page.reload();
  await expect(
    page.getByText('second@example.test', { exact: true }),
  ).toBeVisible();
});

test('a failed password attempt leaves an existing session intact', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await authenticate(context, false, 'email');
  const before = await context.cookies();
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({
      status: 400,
      json: { code: 'invalid_credentials', message: 'Invalid credentials' },
    }),
  );
  await fillLogin(page, randomUUID());
  await page
    .getByRole('button', { name: '이메일로 로그인', exact: true })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    '이메일 또는 비밀번호를 확인해주세요.',
  );
  expect(await context.cookies()).toEqual(before);
});

for (const width of [320, 375, 390, 430, 512, 1440]) {
  test(`password form layout and accessible error at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/login');
    // Wait for the streamed page to become visible, not just attached in the DOM.
    await page.getByLabel('이메일', { exact: true }).click();
    await expect(
      page.getByRole('button', { name: '이메일로 로그인', exact: true }),
    ).toBeVisible();
    await mkdir('artifacts/wo-002.1/screenshots', { recursive: true });
    await page.screenshot({
      path: `artifacts/wo-002.1/screenshots/login-${width}.png`,
      fullPage: true,
      caret: 'initial',
    });
    await page
      .getByRole('button', { name: '이메일로 로그인', exact: true })
      .click();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('이메일', { exact: true })).toHaveAttribute(
      'aria-describedby',
      'login-message',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const shell = await page.getByRole('main').boundingBox();
    expect(shell?.width).toBe(
      Math.min(width, width < 768 ? 512 : width < 1024 ? 768 : 1152),
    );
    for (const label of ['이메일', '비밀번호']) {
      const box = await page.getByLabel(label, { exact: true }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await mkdir('artifacts/wo-002.1/screenshots', { recursive: true });
    await page.screenshot({
      path: `artifacts/wo-002.1/screenshots/login-error-${width}.png`,
      fullPage: true,
    });
  });
}
