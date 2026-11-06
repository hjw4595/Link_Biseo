import { test, expect } from '@playwright/test';
import {
  isOpenResponse,
  isStatusResponse,
  isPingResponse,
} from '../src/contracts/browser-extension';
import {
  sendExtensionMessage,
  ExtensionError,
  type ExtensionRuntime,
} from '../src/lib/browser/biseo-extension';
import { createLaunchStore } from '../src/features/link-launch/store';
const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const request = { type: 'BISEO_PING', version: 1 } as const;
test('memory stores have deterministic initial state and isolated actions/reset', () => {
  const a = createLaunchStore(),
    b = createLaunchStore();
  a.getState().update({ mode: 'incognito', incognitoPermission: 'allowed' });
  expect(b.getState().mode).toBe('normal');
  a.getState().reset();
  expect(a.getState().mode).toBe('normal');
  expect(a.getState().incognitoPermission).toBe('unknown');
});
test('PING and permission false are valid; malformed/old replies are not permission denial', () => {
  expect(isPingResponse({ ok: true, type: 'BISEO_PONG', version: 1 })).toBe(
    true,
  );
  expect(
    isStatusResponse({
      ok: true,
      type: 'BISEO_STATUS_RESULT',
      version: 1,
      incognitoAllowed: false,
    }),
  ).toBe(true);
  for (const v of [
    null,
    {},
    {
      ok: true,
      type: 'BISEO_STATUS_RESULT',
      version: 1,
      incognitoAllowed: 'false',
    },
    {
      ok: true,
      type: 'BISEO_STATUS_RESULT',
      version: 2,
      incognitoAllowed: true,
    },
  ])
    expect(isStatusResponse(v)).toBe(false);
});
for (const counts of [
  [2, 2, true],
  [1, 1, false],
  [2, 1, false],
  [2, 3, false],
  [2.5, 2, false],
  [0, 0, false],
] as const)
  test(`full success counts ${counts[0]}/${counts[1]}`, () => {
    expect(
      isOpenResponse(
        {
          ok: true,
          type: 'BISEO_OPEN_URLS_RESULT',
          version: 1,
          requestedCount: counts[0],
          openedCount: counts[1],
        },
        2,
      ),
    ).toBe(counts[2]);
  });
test('validates preflight, partial and unknown OPEN errors without inventing per-URL results', () => {
  const error = (code: string, rest = {}) => ({
    ok: false,
    type: 'BISEO_OPEN_URLS_ERROR',
    version: 1,
    code,
    ...rest,
  });
  expect(isOpenResponse(error('INCOGNITO_NOT_ALLOWED'), 2)).toBe(true);
  expect(isOpenResponse(error('OPEN_FAILED'), 2)).toBe(true);
  expect(
    isOpenResponse(
      error('OPEN_FAILED', { requestedCount: 2, openedCount: 0 }),
      2,
    ),
  ).toBe(true);
  expect(
    isOpenResponse(
      error('PARTIAL_OPEN_FAILED', { requestedCount: 2, openedCount: 1 }),
      2,
    ),
  ).toBe(true);
  for (const v of [
    error('TIMEOUT'),
    error('PARTIAL_OPEN_FAILED'),
    error('PARTIAL_OPEN_FAILED', { requestedCount: 2, openedCount: 2 }),
    error('INCOGNITO_NOT_ALLOWED', { requestedCount: 2, openedCount: 0 }),
  ])
    expect(isOpenResponse(v, 2)).toBe(false);
});
test('transport rejects missing/invalid IDs before calling Chrome', async () => {
  let calls = 0;
  const api: ExtensionRuntime = {
    sendMessage: () => {
      calls++;
    },
  };
  for (const value of [undefined, '', 'bad', 'z'.repeat(32)])
    await expect(
      sendExtensionMessage(api, value, request),
    ).rejects.toMatchObject({ kind: 'configuration' });
  expect(calls).toBe(0);
});
test('transport handles exceptions, lastError and undefined response', async () => {
  for (const api of [
    {
      sendMessage: () => {
        throw Error('private');
      },
    },
    { sendMessage: (_id, _request, callback) => callback(undefined) },
    {
      lastError: { message: 'private' },
      sendMessage: (_id, _request, callback) => callback({ ok: true }),
    },
  ] satisfies ExtensionRuntime[])
    await expect(sendExtensionMessage(api, id, request)).rejects.toMatchObject({
      kind: 'transport',
    });
});
test('timeout ignores late/duplicate completion and never resends', async () => {
  let calls = 0;
  let callback: ((v: unknown) => void) | undefined;
  const api: ExtensionRuntime = {
    sendMessage: (_id, _message, cb) => {
      calls++;
      callback = cb;
    },
  };
  await expect(
    sendExtensionMessage(api, id, request, undefined, 10),
  ).rejects.toBeInstanceOf(ExtensionError);
  callback?.({ ok: true });
  callback?.({ ok: true });
  expect(calls).toBe(1);
});
test('abort suppresses late replies without retrying', async () => {
  const controller = new AbortController();
  const promise = sendExtensionMessage(
    { sendMessage: () => {} },
    id,
    request,
    controller.signal,
  );
  controller.abort();
  await expect(promise).rejects.toMatchObject({ kind: 'aborted' });
});
