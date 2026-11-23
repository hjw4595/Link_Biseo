import { expect, test } from '@playwright/test';
import { ApiRequestError } from '../src/lib/api/client';
import { expectEmptyResponse, readJsonResponse } from '../src/lib/api/response';
import { isHealthResponse } from '../src/contracts';
import { classifyImportError } from '../src/screens/links/import/import-runner';

for (const [status, kind] of [
  [400, 'http'],
  [401, 'unauthorized'],
  [403, 'forbidden'],
  [404, 'http'],
  [409, 'http'],
  [429, 'http'],
  [500, 'server'],
] as const)
  test(`HTTP ${status} has a consistent error shape even when its body is not JSON`, async () => {
    const response = new Response('upstream HTML error', { status });
    const result = readJsonResponse(response, isHealthResponse);
    await expect(result).rejects.toBeInstanceOf(ApiRequestError);
    await expect(result).rejects.toMatchObject({ kind, status });
    expect(response.bodyUsed).toBe(false);
  });

test('successful HTTP status still requires the expected body and endpoint status', async () => {
  await expect(
    readJsonResponse(Response.json({ status: 'ok' }), isHealthResponse, 200),
  ).resolves.toEqual({ status: 'ok' });
  for (const response of [
    new Response('invalid JSON'),
    Response.json({ status: 'wrong' }),
    Response.json({ status: 'ok' }, { status: 202 }),
  ])
    await expect(
      readJsonResponse(response, isHealthResponse, 200),
    ).rejects.toMatchObject({ kind: 'invalid', status: undefined });
});

test('DELETE requires 204 and never consumes a response body', () => {
  expect(() =>
    expectEmptyResponse(new Response(null, { status: 204 })),
  ).not.toThrow();
  expect(() => expectEmptyResponse(Response.json({}))).toThrow(ApiRequestError);
  try {
    expectEmptyResponse(new Response('failure', { status: 404 }));
    throw new Error('Expected rejection');
  } catch (error) {
    expect(error).toMatchObject({ kind: 'http', status: 404 });
  }
});

test('a malformed successful write stays unknown, while a rejected duplicate stays definite', async () => {
  for (const [response, outcome] of [
    [Response.json({ status: 'wrong' }, { status: 201 }), 'unknown'],
    [new Response('conflict', { status: 409 }), 'duplicate_server'],
  ] as const) {
    try {
      await readJsonResponse(response, isHealthResponse, 201);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(classifyImportError(error).outcome).toBe(outcome);
    }
  }
});
