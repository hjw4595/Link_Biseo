import { test as base, expect, type BrowserContext } from '@playwright/test';
import { installProductApi } from './product-fixture';

export const testUser = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'tester@example.test',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: '테스트 사용자' },
  created_at: '2026-01-01T00:00:00Z',
};
export function testSession(expired = false, kind = 'valid') {
  const identity =
    kind === 'alternate' || kind === 'email-alternate'
      ? {
          ...testUser,
          id: '22222222-2222-4222-8222-222222222222',
          email: 'second@example.test',
        }
      : testUser;
  const user = kind.startsWith('email')
    ? { ...identity, app_metadata: { provider: 'email' }, user_metadata: {} }
    : identity;
  const expires = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  const access = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: expires,
        aud: 'authenticated',
        kind,
      }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  return {
    access_token: access,
    refresh_token:
      kind === 'expired'
        ? 'invalid-refresh'
        : kind.startsWith('email')
          ? `test-refresh-${kind}`
          : 'test-refresh',
    token_type: 'bearer' as const,
    expires_in: 3600,
    expires_at: expires,
    user,
  };
}
export async function authenticate(
  context: BrowserContext,
  expired = false,
  kind = 'valid',
) {
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value:
        'base64-' +
        Buffer.from(JSON.stringify(testSession(expired, kind))).toString(
          'base64url',
        ),
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ]);
}
export const test = base.extend<{
  authenticatedContext: void;
  productTime: string | undefined;
}>({
  // Only visual baselines opt in; authentication/JWT time stays on the real clock.
  productTime: [undefined, { option: true }],
  page: async ({ page }, providePage) => {
    // Next's development-only Insight badge can cover the mobile Home tab.
    // Dispatch only this framework control's click: a pointer-down outside a
    // Radix Sheet would dismiss it and a physical click would steal app focus.
    // Product clicks remain real; runtime error overlays stay visible.
    await page.addLocatorHandler(
      page.getByRole('button', { name: 'Collapse issues badge', exact: true }),
      async (button) => {
        await button.dispatchEvent('click');
      },
    );
    await providePage(page);
  },
  authenticatedContext: [
    async ({ context, productTime }, use) => {
      await authenticate(context);
      // All external navigations stay inside Browser Mock tests, including popups.
      await context.route(
        /^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/,
        (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<h1>Mock external site</h1>',
          }),
      );
      await installProductApi(context, {
        now: productTime === undefined ? undefined : Date.parse(productTime),
      });
      await use();
    },
    { auto: true },
  ],
});
export { expect };
