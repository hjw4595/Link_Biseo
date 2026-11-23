import { test, expect } from '@playwright/test';
import { getAuthRequestOrigin } from '../src/features/auth/request-origin';
import { safeNext } from '../src/features/auth/redirect';

const productionOrigin =
  'https://biseo-web-387226361382.asia-northeast3.run.app';
const productionHost = new URL(productionOrigin).host;
const production = { production: true, appOrigin: productionOrigin };

test('Cloud Run redirects use an allowlisted public host instead of the container URL', () => {
  for (const headers of headerCases([
    { host: productionHost, 'x-forwarded-proto': 'https' },
    {
      host: 'container:3000',
      'x-forwarded-host': productionHost,
      'x-forwarded-proto': 'https',
    },
    { host: productionHost },
  ])) {
    const request = new Request('https://localhost:3000/auth/callback', {
      headers,
    });
    expect(getAuthRequestOrigin(request, production)).toBe(productionOrigin);
    expect(
      new URL(
        safeNext('/links?sort=recent'),
        getAuthRequestOrigin(request, production)!,
      ).href,
    ).toBe(`${productionOrigin}/links?sort=recent`);
  }
});

test('untrusted hosts, forwarded values and invalid production configuration fail closed', () => {
  for (const host of [
    'evil.test',
    'localhost:3000',
    `${productionHost}.evil.test`,
    `${productionHost}:444`,
    `${productionHost}@evil.test`,
    `${productionHost}/path`,
    `${productionHost}, evil.test`,
    '',
  ]) {
    for (const headers of headerCases([
      { host },
      { host: productionHost, 'x-forwarded-host': host },
    ])) {
      expect(
        getAuthRequestOrigin(
          new Request('https://localhost:3000', { headers }),
          production,
        ),
      ).toBeNull();
    }
  }
  for (const proto of ['http', 'https,http', 'javascript', '']) {
    expect(
      getAuthRequestOrigin(
        new Request(productionOrigin, {
          headers: { host: productionHost, 'x-forwarded-proto': proto },
        }),
        production,
      ),
    ).toBeNull();
  }
  for (const appOrigin of [
    undefined,
    '',
    'http://example.com',
    'https://localhost:3000',
    `${productionOrigin}/path`,
    `${productionOrigin}?query=1`,
    `${productionOrigin}#hash`,
    'https://user:pass@example.com',
  ]) {
    expect(
      getAuthRequestOrigin(
        new Request(productionOrigin, {
          headers: { host: productionHost },
        }),
        { production: true, appOrigin },
      ),
    ).toBeNull();
  }
});

test('local development keeps the actual origin and port', () => {
  for (const origin of [
    'http://localhost:3100',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
  ]) {
    expect(
      getAuthRequestOrigin(
        new Request(origin, {
          headers: { host: new URL(origin).host },
        }),
        { production: false },
      ),
    ).toBe(origin);
  }
  expect(
    getAuthRequestOrigin(
      new Request('http://localhost:3100/auth/callback', {
        headers: { host: '127.0.0.1:3100' },
      }),
      { production: false },
    ),
  ).toBe('http://127.0.0.1:3100');
});

test('callback and Proxy reject hostile headers without redirecting', async ({
  request,
}) => {
  for (const path of ['/auth/callback?code=invalid', '/links', '/login']) {
    for (const headers of headerCases([
      { host: 'evil.test' },
      { 'x-forwarded-host': 'evil.test' },
      { 'x-forwarded-host': 'localhost:3100, evil.test' },
      { 'x-forwarded-proto': 'https,http' },
    ])) {
      const response = await request.get(path, { headers, maxRedirects: 0 });
      expect(response.status()).toBe(400);
      expect(response.headers().location).toBeUndefined();
      expect(response.headers()['cache-control']).toContain('no-store');
    }
  }
});

test('callback failures and Proxy login redirects preserve only internal next paths', async ({
  request,
}) => {
  for (const next of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%2f%2fevil.test',
    '/%252f%252fevil.test',
  ]) {
    const response = await request.get(
      `/auth/callback?error=access_denied&next=${encodeURIComponent(next)}`,
      { maxRedirects: 0 },
    );
    const location = new URL(response.headers().location!);
    expect(location.origin).toBe('http://localhost:3100');
    expect(location.searchParams.get('next')).toBe('/');
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
  }
  const response = await request.get('/links?sort=recent', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const location = new URL(
    response.headers().location!,
    'http://localhost:3100',
  );
  expect(location.origin).toBe('http://localhost:3100');
  expect(location.searchParams.get('next')).toBe('/links?sort=recent');
});

function headerCases(values: Record<string, string>[]) {
  return values;
}
