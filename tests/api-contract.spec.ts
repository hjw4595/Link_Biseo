import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { authenticatedRequest } from '../src/lib/api/client';
import { listLinks, removeLink } from '../src/lib/api/links';
import {
  isLinkResponse,
  isListLinksResponse,
  isOpenLinkResponse,
} from '../src/contracts/links';
import { initialProduct } from './product-fixture';
import { testSession, testUser } from './auth-fixture';

test('Link contracts reject malformed fields and accept nullable metadata', () => {
  const row = initialProduct().links[0];
  if (!row) throw new Error('Missing fixture');
  expect(
    isLinkResponse({
      ...row,
      categoryId: null,
      description: null,
      faviconUrl: null,
      lastOpenedAt: null,
    }),
  ).toBe(true);
  for (const invalid of [
    null,
    {},
    { ...row, id: 'bad' },
    { ...row, clickCount: -1 },
    { ...row, isFavorite: 'true' },
    { ...row, createdAt: 'bad' },
    { ...row, description: 7 },
    { ...row, categoryId: '' },
  ])
    expect(isLinkResponse(invalid)).toBe(false);
  expect(isListLinksResponse({ items: [row], nextCursor: null })).toBe(true);
  expect(
    isListLinksResponse({ items: [row], nextCursor: '20.signature' }),
  ).toBe(true);
  expect(isListLinksResponse({ items: [row], nextCursor: '' })).toBe(false);
  expect(
    isOpenLinkResponse({ url: 'https://example.org', openedAt: row.createdAt }),
  ).toBe(true);
  expect(
    isOpenLinkResponse({ url: 'https://example.org', openedAt: null }),
  ).toBe(false);
});

test('API methods, query, JSON body, 204, status errors, timeout and abort', async () => {
  const beforeFetch = globalThis.fetch;
  const beforeUrl = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  const client = createClient('http://127.0.0.1:54329', 'test-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  client.auth.getSession = async () => ({
    data: { session: testSession() },
    error: null,
  });
  let refreshes = 0;
  client.auth.refreshSession = async () => {
    refreshes++;
    return { data: { session: testSession(), user: testUser }, error: null };
  };
  try {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        expect(url.searchParams.get('favorite')).toBe('true');
        expect(url.searchParams.get('categoryId')).toBe('uncategorized');
        expect(url.searchParams.has('cursor')).toBe(false);
        expect(init?.method).toBe(method);
        expect(new Headers(init?.headers).get('authorization')).toMatch(
          /^Bearer /,
        );
        expect(init?.redirect).toBe('error');
        expect(init?.credentials).toBe('omit');
        if (method !== 'GET') expect(init?.body).toBe('{"isFavorite":true}');
        return new Response(null, { status: 204 });
      };
      expect(
        (
          await authenticatedRequest(client, testUser.id, '/links', {
            method,
            query: {
              favorite: true,
              categoryId: 'uncategorized',
              cursor: undefined,
            },
            ...(method === 'GET' ? {} : { body: { isFavorite: true } }),
          })
        ).status,
      ).toBe(204);
    }
    globalThis.fetch = async () => new Response(null, { status: 204 });
    await expect(
      removeLink(client, testUser.id, 'id'),
    ).resolves.toBeUndefined();
    for (const status of [400, 401, 403, 404, 409, 500, 503]) {
      let calls = 0;
      refreshes = 0;
      globalThis.fetch = async () => {
        calls++;
        return Response.json({}, { status });
      };
      await expect(listLinks(client, testUser.id, {})).rejects.toBeDefined();
      expect(calls).toBe(status === 401 ? 2 : 1);
      expect(refreshes).toBe(status === 401 ? 1 : 0);
    }
    globalThis.fetch = async () =>
      Response.json({ items: [{}], nextCursor: null });
    await expect(listLinks(client, testUser.id, {})).rejects.toMatchObject({
      kind: 'invalid',
    });
    globalThis.fetch = async () => {
      throw new TypeError('network');
    };
    await expect(
      authenticatedRequest(client, testUser.id, '/links'),
    ).rejects.toMatchObject({ kind: 'network' });
    globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new Error('aborted')),
          { once: true },
        );
      });
    await expect(
      authenticatedRequest(client, testUser.id, '/links', { timeoutMs: 10 }),
    ).rejects.toMatchObject({ kind: 'timeout' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      authenticatedRequest(client, testUser.id, '/links', {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ kind: 'aborted' });
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({});
    };
    await expect(
      authenticatedRequest(client, 'another-user', '/links'),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(calls).toBe(0);
  } finally {
    globalThis.fetch = beforeFetch;
    if (beforeUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = beforeUrl;
  }
});
