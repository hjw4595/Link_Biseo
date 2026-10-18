import { test, expect } from '@playwright/test';
import {
  runImport,
  classifyImportError,
  type RunItem,
  type ItemResult,
} from '../src/features/bookmark-import/import-runner';
import { LinkApiError } from '../src/lib/api/links';
import { ApiRequestError } from '../src/lib/api/client';
import { initialProduct } from './product-fixture';

const saved = initialProduct().links[0]!;
const items: RunItem[] = Array.from({ length: 50 }, (_, i) => ({
  localId: String(i),
  title: String(i),
  key: `https://example.test/${i}`,
  input: {
    url: `https://example.test/${i}`,
    categoryId: null,
    customTitle: String(i),
  },
}));
test('uncertain response stops new dispatch but drains the other worker and retains its success', async () => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const control = { stopped: false };
  const results: ItemResult[] = [];
  const run = runImport(
    items,
    control,
    () => true,
    async () => {
      if (++calls === 1) throw new ApiRequestError('server', 503);
      await pending;
      return saved;
    },
    (row) => results.push(row),
    () => {},
  );
  await expect.poll(() => control.stopped).toBe(true);
  expect(calls).toBe(2);
  release();
  await run;
  expect(calls).toBe(2);
  expect(results.filter((row) => row.outcome === 'unknown')).toHaveLength(1);
  expect(results.filter((row) => row.outcome === 'imported')).toHaveLength(1);
});
test('runner dispatches 50 unique items through exactly two workers, preserving assignment order', async () => {
  let pending = 0;
  let maximum = 0;
  const dispatched: string[] = [];
  const results: ItemResult[] = [];
  await runImport(
    items,
    { stopped: false },
    () => true,
    async (item) => {
      dispatched.push(item.localId);
      maximum = Math.max(maximum, ++pending);
      await new Promise((resolve) => setTimeout(resolve, 1));
      pending--;
      return saved;
    },
    (result) => results.push(result),
    () => {},
  );
  expect(maximum).toBe(2);
  expect(dispatched).toEqual(items.map((item) => item.localId));
  expect(results.filter((row) => row.outcome === 'imported')).toHaveLength(50);
});
for (const [error, outcome, stop] of [
  [new LinkApiError(409), 'duplicate_server', false],
  [new LinkApiError(400), 'failed', false],
  [new LinkApiError(404), 'failed', true],
  [new ApiRequestError('unauthorized', 401), 'failed', true],
  [new ApiRequestError('forbidden', 403), 'failed', true],
  [new ApiRequestError('unauthorized'), 'unknown', true],
  [new LinkApiError(429), 'unknown', true],
  [new LinkApiError(418), 'unknown', true],
  [new ApiRequestError('server', 500), 'unknown', true],
  [new ApiRequestError('server', 502), 'unknown', true],
  [new ApiRequestError('server', 503), 'unknown', true],
  [new ApiRequestError('network'), 'unknown', true],
  [new ApiRequestError('timeout'), 'unknown', true],
  [new ApiRequestError('invalid'), 'unknown', true],
  [new ApiRequestError('aborted'), 'unknown', true],
] as const)
  test(`classify ${error instanceof LinkApiError ? error.status : error.kind + ':' + error.status}`, () => {
    expect(classifyImportError(error)).toMatchObject({ outcome, stop });
  });
test('stop drains already-dispatched requests; account expiry never publishes their late results', async () => {
  for (const expiry of [false, true]) {
    const control = { stopped: false };
    let live = true;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const results: ItemResult[] = [];
    let calls = 0;
    const work = runImport(
      items,
      control,
      () => live,
      async () => {
        calls++;
        await gate;
        return saved;
      },
      (row) => results.push(row),
      () => {},
    );
    expect(calls).toBe(2);
    control.stopped = true;
    if (expiry) live = false;
    release();
    await work;
    expect(calls).toBe(2);
    expect(results.filter((row) => row.outcome === 'imported')).toHaveLength(
      expiry ? 0 : 2,
    );
  }
});
