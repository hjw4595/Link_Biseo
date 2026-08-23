import { expectAccountVerified } from './account-assertions';
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { installProductApi } from './product-fixture';
test.beforeEach(async ({ context }) => {
  await installProductApi(context);
});
import { authenticate, testUser } from './auth-fixture';
import { safeNext } from '../src/features/auth/redirect';
import { getSupabaseConfig } from '../src/lib/supabase/config';
import { isAuthMeResponse } from '../src/contracts';

test('safe redirects, public configuration and runtime contract', () => {
  for (const value of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%2f%2fevil.test',
    '/%252f%252fevil.test',
    '/%ZZ',
    '/%0aevil',
    '/links/../../auth/callback',
    '/login',
    '/links\n',
  ])
    expect(safeNext(value)).toBe('/');
  expect(
    safeNext('/category/32e83e92-d45d-41f6-8dcf-9d214688f037?filter=favorites'),
  ).toBe('/category/32e83e92-d45d-41f6-8dcf-9d214688f037?filter=favorites');
  const old = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => getSupabaseConfig()).toThrow();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_forbidden';
    expect(() => getSupabaseConfig()).toThrow();
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    expect(getSupabaseConfig().url).toBe('https://example.supabase.co');
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      'header.' +
      Buffer.from(JSON.stringify({ role: 'service_role' })).toString(
        'base64url',
      ) +
      '.signature';
    expect(() => getSupabaseConfig()).toThrow();
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      'header.' +
      Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') +
      '.signature';
    expect(getSupabaseConfig().key).toBeTruthy();
  } finally {
    for (const [name, value] of [
      ['NEXT_PUBLIC_SUPABASE_URL', old.url],
      ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', old.key],
      ['NEXT_PUBLIC_SUPABASE_ANON_KEY', old.anon],
    ]) {
      if (name) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }
  expect(isAuthMeResponse({ id: testUser.id })).toBe(true);
  expect(isAuthMeResponse({ id: testUser.id, email: null })).toBe(false);
  expect(isAuthMeResponse({ id: 'invalid' })).toBe(false);
});

test('every protected route redirects without rendering product content', async ({
  page,
}) => {
  for (const route of [
    '/',
    '/categories',
    '/category/32e83e92-d45d-41f6-8dcf-9d214688f037',
    '/links',
    '/links/new',
    '/links/60965168-ce76-4e94-8600-281ba6d01fee',
    '/settings',
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp('/login\\?next='));
    await expect(
      page.getByRole('button', { name: 'Google로 계속하기' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.getByTestId('link-item')).toHaveCount(0);
  }
  await page.goto('/diagnostics');
  await expect(page).toHaveURL('/diagnostics');
});

test('redirect OAuth uses PKCE, returns to original route and restores cookies', async ({
  page,
  context,
}) => {
  let callbackUrl = '';
  page.on('request', (request) => {
    if (request.url().includes('/auth/callback?')) callbackUrl = request.url();
  });
  await page.goto('/links/new');
  await page.getByRole('button', { name: 'Google로 계속하기' }).click();
  await expect(page).toHaveURL('/links/new');
  expect(
    (await context.cookies()).some((cookie) =>
      cookie.name.startsWith('sb-127-auth-token'),
    ),
  ).toBe(true);
  await page.reload();
  await expect(page).toHaveURL('/links/new');
  await page.goto('/login');
  await expect(page).toHaveURL('/');
  const replay = await context.request.get(callbackUrl, { maxRedirects: 0 });
  expect(replay.headers().location).toContain('error=oauth');
  expect(replay.headers()['cache-control']).toContain('no-store');
});

test('OAuth startup failure restores the button for retry', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let failed = false;
    crypto.subtle.digest = (algorithm, data) => {
      if (!failed) {
        failed = true;
        return Promise.reject(new Error('Test PKCE failure'));
      }
      return digest(algorithm, data);
    };
  });
  await page.goto('/login');
  const button = page.getByRole('button', { name: 'Google로 계속하기' });
  await button.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '로그인을 시작하지 못했어요',
  );
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page).toHaveURL('/');
});

test('callback denial, missing code and invalid code are recoverable', async ({
  page,
}) => {
  for (const query of [
    'error=access_denied',
    '',
    'code=invalid&next=%2F%2Fevil.test',
  ]) {
    await page.goto('/auth/callback?' + query);
    await expect(page).toHaveURL(/\/login\?error=oauth/);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      '로그인을 완료하지 못했어요',
    );
    await expect(
      page.getByRole('button', { name: 'Google로 계속하기' }),
    ).toBeEnabled();
  }
});

test('missing Google profile has a fallback and client session expiry hides protected UI', async ({
  page,
  context,
}) => {
  await authenticate(context);
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({
      json: { ...testUser, email: undefined, user_metadata: {} },
    }),
  );
  await page.goto('/settings');
  await expect(page.getByText('내 계정', { exact: true })).toBeVisible();
  await expect(page.getByText(testUser.email)).toHaveCount(0);
  await page.unroute('**/auth/v1/user');
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('verified account change isolates previous server cache', async ({
  page,
  context,
}) => {
  await authenticate(context);
  await page.goto('/category/32e83e92-d45d-41f6-8dcf-9d214688f037');
  const favorite = page.getByRole('button', {
    name: 'Claude 즐겨찾기',
    exact: true,
  });
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await authenticate(context, false, 'alternate');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(favorite).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await expect(page.getByText('second@example.test')).toBeVisible();
  await expectAccountVerified(page);
});

test('client auth verification failure shows retry without product content', async ({
  page,
  context,
}) => {
  await authenticate(context);
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({ status: 503, json: { message: 'unavailable' } }),
  );
  await page.goto('/settings');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '로그인 상태를 확인할 수 없어요',
  );
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.unroute('**/auth/v1/user');
  await page.getByRole('button', { name: '다시 확인', exact: true }).click();
  await expect(page.getByText(testUser.email)).toBeVisible();
});

test('expired session refreshes in Proxy, rejected cookie cannot authorize', async ({
  page,
  context,
}) => {
  await authenticate(context, true);
  await page.goto('/settings');
  await expect(page.getByText(testUser.email)).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL('/settings');
  // Stop the old SDK instance before replacing its cookies with attack fixtures.
  await page.goto('about:blank');
  await context.clearCookies();
  await authenticate(context, false, 'invalid');
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('about:blank');
  await context.clearCookies();
  await authenticate(context, true, 'expired');
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('settings API bearer, session restoration and logout protect subsequent navigation', async ({
  page,
  context,
  browser,
}) => {
  await authenticate(context);
  let bearer = false;
  await page.route('**/auth/me', async (route) => {
    bearer =
      route.request().headers().authorization?.startsWith('Bearer ') === true;
    await route.continue();
  });
  await page.goto('/settings');
  await expectAccountVerified(page);
  expect(bearer).toBe(true);
  const restored = await browser.newContext({
    storageState: await context.storageState(),
  });
  const restoredPage = await restored.newPage();
  await restoredPage.goto('http://localhost:3100/settings');
  await expect(restoredPage.getByText(testUser.email)).toBeVisible();
  await restored.close();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login/);
});

for (const status of [401, 403, 500]) {
  test(`API ${status} preserves login and supports retry`, async ({
    page,
    context,
  }) => {
    await authenticate(context);
    let calls = 0;
    await page.route('**/auth/me', async (route) => {
      calls++;
      await route.fulfill({ status, json: {} });
    });
    await page.goto('/settings');
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(page.getByText(testUser.email)).toBeVisible();
    expect(calls).toBe(status === 401 ? 2 : 1);
    await expect(page).toHaveURL('/settings');
    await page.unroute('**/auth/me');
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expectAccountVerified(page);
  });
}

test('network and malformed API response do not fabricate verification', async ({
  page,
  context,
}) => {
  await authenticate(context);
  await page.route('**/auth/me', (route) => route.abort());
  await page.goto('/settings');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '계정 정보를 확인하지 못했어요.',
  );
  await page.unroute('**/auth/me');
  await page.route('**/auth/me', (route) =>
    route.fulfill({ json: { id: 'wrong-user' } }),
  );
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '계정 정보를 확인하지 못했어요.',
  );
  await page.unroute('**/auth/me');
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expectAccountVerified(page);
});

test('logout failure reports local-only cleanup, reauthentication restores server state', async ({
  page,
  context,
}) => {
  await authenticate(context);
  await page.goto('/category/32e83e92-d45d-41f6-8dcf-9d214688f037');
  await page
    .getByRole('button', { name: 'Claude 즐겨찾기', exact: true })
    .click();
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await page.route('**/auth/v1/logout*', (route) =>
    route.fulfill({ status: 500, json: { message: 'unavailable' } }),
  );
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL('/login?error=logout');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '서버의 세션 종료는 확인하지 못했어요',
  );
  await page.unroute('**/auth/v1/logout*');
  // Logout performs a document navigation; wait for the login bundle to hydrate.
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Google로 계속하기' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/category/32e83e92-d45d-41f6-8dcf-9d214688f037');
  await expect(
    page.getByRole('button', { name: 'Claude 즐겨찾기', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

for (const width of [320, 390, 430, 512, 1440]) {
  test(`authentication screens at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const directory = path.resolve(
      process.cwd(),
      'artifacts/wo-002/screenshots',
    );
    await mkdir(directory, { recursive: true });
    async function capture(name: string) {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: path.join(directory, `${name}-${width}.png`),
        fullPage: true,
        // Hiding carets mutates input styles before hydration on public pages.
        caret: 'initial',
      });
    }
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole('button', { name: 'Google로 계속하기' }),
    ).toBeVisible();
    await capture('login-redirect');
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await page.goto('/auth/callback?error=access_denied');
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await capture('oauth-error');
    await authenticate(context);
    let releaseUser: () => void = () => {};
    const waitForUser = new Promise<void>((resolve) => {
      releaseUser = resolve;
    });
    await page.route('**/auth/v1/user', async (route) => {
      await waitForUser;
      await route.continue();
    });
    await page.goto('/settings');
    await expect(
      page.getByText('로그인 상태를 확인하고 있어요.'),
    ).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await capture('auth-loading');
    releaseUser();
    await expectAccountVerified(page);
    await capture('settings');
    await expect(page.getByRole('navigation')).toBeVisible();
    await page.route('**/auth/me', (route) =>
      route.fulfill({ status: 500, json: {} }),
    );
    await page.reload();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await capture('api-error');
  });
}
