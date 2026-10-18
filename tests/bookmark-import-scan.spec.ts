import { test, expect } from '@playwright/test';
import { scanExistingLinks } from '../src/features/bookmark-import/scan-existing-links';
import { initialProduct, fixtureId } from './product-fixture';

function link(index: number) {
  const base = initialProduct().links[0];
  if (!base) throw new Error('Missing fixture');
  return {
    ...base,
    id: fixtureId(`import-${index}`),
    url: `https://example.com/${index}`,
    domain: 'example.com',
  };
}
test('scan passes opaque cursors sequentially, deduplicates page overlap, ends only on null', async () => {
  const seen: (string | undefined)[] = [];
  let active = 0;
  const result = await scanExistingLinks(async (cursor) => {
    seen.push(cursor);
    expect(++active).toBe(1);
    await Promise.resolve();
    active--;
    return cursor
      ? { items: [link(99), link(100)], nextCursor: null }
      : {
          items: Array.from({ length: 100 }, (_, i) => link(i)),
          nextCursor: 'opaque.server_signature',
        };
  }, new AbortController().signal);
  expect(seen).toEqual([undefined, 'opaque.server_signature']);
  expect(result.count).toBe(101);
  expect(result.index.get('https://example.com/100')).toBe(link(100).id);
});
test('scan rejects failed, repeated, empty continuing and inconsistent pages', async () => {
  const signal = new AbortController().signal;
  await expect(
    scanExistingLinks(() => Promise.reject(new Error('network')), signal),
  ).rejects.toThrow('network');
  await expect(
    scanExistingLinks(
      async () => ({ items: [link(0)], nextCursor: 'same.cursor' }),
      signal,
    ),
  ).rejects.toThrow('cursor');
  await expect(
    scanExistingLinks(
      async () => ({ items: [], nextCursor: 'next.cursor' }),
      signal,
    ),
  ).rejects.toThrow('cursor');
  await expect(
    scanExistingLinks(
      async () => ({
        items: [link(0), { ...link(1), url: link(0).url }],
        nextCursor: null,
      }),
      signal,
    ),
  ).rejects.toThrow('invalid');
  await expect(
    scanExistingLinks(
      async () => ({
        items: [{ ...link(0), url: 'javascript:alert(1)' }],
        nextCursor: null,
      }),
      signal,
    ),
  ).rejects.toThrow('invalid');
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await expect(
    scanExistingLinks(async () => {
      calls++;
      return { items: [], nextCursor: null };
    }, controller.signal),
  ).rejects.toThrow();
  expect(calls).toBe(0);
});
test('scan accepts 5000 at the final page, rejects a 51st page and oversized responses', async () => {
  for (const terminal of [true, false]) {
    let pages = 0;
    const work = scanExistingLinks(async () => {
      const offset = pages++ * 100;
      return {
        items: Array.from({ length: 100 }, (_, i) => link(offset + i)),
        nextCursor: terminal && pages === 50 ? null : `${pages}.cursor`,
      };
    }, new AbortController().signal);
    if (terminal) expect((await work).count).toBe(5000);
    else await expect(work).rejects.toThrow('limit');
    expect(pages).toBe(50);
  }
  await expect(
    scanExistingLinks(
      async () => ({
        items: Array.from({ length: 101 }, (_, i) => link(i)),
        nextCursor: null,
      }),
      new AbortController().signal,
    ),
  ).rejects.toThrow('invalid');
});
test('30 second overall deadline covers a loader that never settles; abort suppresses late work', async () => {
  const original = AbortSignal.timeout;
  AbortSignal.timeout = (ms) => {
    expect(ms).toBe(30_000);
    return original(20);
  };
  try {
    await expect(
      scanExistingLinks(
        () => new Promise(() => {}),
        new AbortController().signal,
      ),
    ).rejects.toThrow('timeout');
  } finally {
    AbortSignal.timeout = original;
  }
  const controller = new AbortController();
  const work = scanExistingLinks(
    () => new Promise(() => {}),
    controller.signal,
  );
  controller.abort();
  await expect(work).rejects.toThrow();
});
