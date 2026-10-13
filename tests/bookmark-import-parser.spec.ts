import { test, expect } from '@playwright/test';
import {
  bookmarkFixture,
  bookmarkHtml,
  compareInBrowser,
  parseInBrowser,
  measureParser,
} from './bookmark-browser-helper';
import {
  bookmarkComparisonKey,
  buildImportItems,
  compareExisting,
} from '../src/features/bookmark-import/utils/detect-import-duplicates';
import type { ParsedBookmark } from '../src/features/bookmark-import/types';
import { mkdirSync, writeFileSync } from 'node:fs';

test('Chrome export preserves nested/empty folders, order, Unicode and raw dates/query/hash', async ({
  page,
}) => {
  const result = await parseInBrowser(page, bookmarkFixture('chrome.html'));
  expect(result).toEqual([
    expect.objectContaining({
      sourceIndex: 0,
      localId: '7:0',
      originalTitle: '한글 & 日本語',
      folderPath: ['북마크바'],
      originalUrl: 'https://example.com/Page?a=2&a=1&utm_source=x#section',
      sourceDates: {
        addDate: '1600000001',
        lastModified: null,
        lastVisit: null,
      },
    }),
    expect.objectContaining({
      sourceIndex: 1,
      originalTitle: 'React',
      folderPath: ['북마크바', '개발'],
    }),
    expect.objectContaining({
      sourceIndex: 2,
      originalTitle: '바깥 링크',
      folderPath: ['북마크바'],
    }),
    expect.objectContaining({
      sourceIndex: 3,
      originalTitle: '루트',
      folderPath: [],
    }),
  ]);
});
test('Edge and Firefox exports support their folder and date shapes', async ({
  page,
}) => {
  expect(await parseInBrowser(page, bookmarkFixture('edge.html'))).toEqual([
    expect.objectContaining({ sourceIndex: 0, folderPath: ['즐겨찾기 모음'] }),
    expect.objectContaining({
      sourceIndex: 1,
      folderPath: ['즐겨찾기 모음', '자료'],
    }),
  ]);
  expect(await parseInBrowser(page, bookmarkFixture('firefox.html'))).toEqual([
    expect.objectContaining({
      originalTitle: '日本語の資料',
      sourceDates: {
        addDate: '1700000002',
        lastModified: '1700000003',
        lastVisit: '1700000004',
      },
      originalUrl: 'https://example.com/search?q=%E6%97%A5%E6%9C%AC#results',
    }),
    expect.objectContaining({
      originalTitle: 'HTTP 링크',
      folderPath: ['ブックマーク'],
    }),
  ]);
});
test('parser rejects the entire invalid/over-limit document and accepts exact bounds', async ({
  page,
}) => {
  for (const html of ['', '   '])
    expect(await parseInBrowser(page, html)).toEqual({ error: 'empty_file' });
  for (const html of [
    '<a href="https://example.com">web</a>',
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<H1>Bookmarks</H1><DL><A href="https://example.com">no DT</A></DL>',
    '<H1>Bookmarks</H1><DL><DL></DL></DL>',
  ])
    expect(await parseInBrowser(page, html)).toEqual({
      error: 'invalid_structure',
    });
  expect(await parseInBrowser(page, bookmarkHtml(0))).toEqual([]);
  expect(await parseInBrowser(page, bookmarkHtml(500))).toHaveLength(500);
  expect(await parseInBrowser(page, bookmarkHtml(501))).toEqual({
    error: 'limit_exceeded',
  });
  for (const depth of [32, 33]) {
    const html =
      '<H1>Bookmarks</H1><DL>' +
      '<DT><H3>folder</H3><DL>'.repeat(depth) +
      '<DT><A HREF="https://example.com">x</A>' +
      '</DL>'.repeat(depth + 1);
    const result = await parseInBrowser(page, html);
    if (depth === 32)
      expect(result).toEqual([
        expect.objectContaining({ folderPath: Array(32).fill('folder') }),
      ]);
    else expect(result).toEqual({ error: 'limit_exceeded' });
  }
  // H1 + its text + DL = 3 nodes, then comment nodes counted individually.
  expect(
    await parseInBrowser(
      page,
      '<H1>Bookmarks</H1><DL>' + '<!--x-->'.repeat(19_997) + '</DL>',
    ),
  ).toEqual([]);
  expect(
    await parseInBrowser(
      page,
      '<H1>Bookmarks</H1><DL>' + '<!--x-->'.repeat(19_998) + '</DL>',
    ),
  ).toEqual({ error: 'limit_exceeded' });
  expect(
    await parseInBrowser(page, '<meta charset="shift_jis">' + bookmarkHtml(1)),
  ).toEqual({ error: 'unsupported_encoding' });
});
test('inert parser executes zero scripts and makes zero external resource requests', async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route('**/*', async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  const result = await parseInBrowser(page, bookmarkFixture('hostile.html'));
  expect(result).toHaveLength(3);
  await page.waitForTimeout(150);
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(() => Reflect.get(globalThis, 'bookmarkExecuted')),
  ).toBeUndefined();
  expect(
    await page.locator('img, iframe, script, style, object, video').count(),
  ).toBe(0);
});

// Expected outputs audited against BE apps/api/test/url-normalizer.spec.ts and
// the actual normalizeUrl source, 2026-10-26. IPv6 is intentionally unverified.
const parity: [string, string][] = [
  ['HTTPS://Example.COM', 'https://example.com/'],
  ['http://Example.com:80', 'http://example.com/'],
  ['https://Example.com:443', 'https://example.com/'],
  ['https://example.com:8443/', 'https://example.com:8443/'],
  ['https://example.com/Page#section', 'https://example.com/Page'],
  ['https://example.com/Page/', 'https://example.com/Page/'],
  [
    'https://example.com/Page?a=2&a=1&utm_source=x',
    'https://example.com/Page?a=2&a=1&utm_source=x',
  ],
  ['http://www.example.com', 'http://www.example.com/'],
  [' https://example.com/ ', 'https://example.com/'],
  ['https://例え.テスト/', 'https://xn--r8jz45g.xn--zckzah/'],
  ['http://127.0.0.1/', 'http://127.0.0.1/'],
  ['https://example.com/a/../b', 'https://example.com/b'],
];
test('browser and Node comparison match server normalization fixtures without merging different URLs', async ({
  page,
}) => {
  const expected = parity.map(([, key]) =>
    expect.objectContaining({ kind: 'verified', key }),
  );
  expect(parity.map(([input]) => bookmarkComparisonKey(input))).toEqual(
    expected,
  );
  expect(
    await compareInBrowser(
      page,
      parity.map(([input]) => input),
    ),
  ).toEqual(expected);
  const different = [
    'http://example.com/page',
    'https://example.com/page',
    'https://www.example.com/page',
    'https://example.com/Page',
    'https://example.com/page/',
    'https://example.com/page?a=1',
    'https://example.com/page?a=2',
    'https://example.com/page?a=1&b=2',
    'https://example.com/page?b=2&a=1',
    'https://example.com/page?utm_source=x',
  ];
  const keys = different
    .map((url) => bookmarkComparisonKey(url))
    .map((result) => (result.kind === 'verified' ? result.key : null));
  expect(new Set(keys).size).toBe(different.length);
  expect(bookmarkComparisonKey('https://[2001:4860:4860::8888]/')).toEqual({
    kind: 'comparison_unverified',
  });
});
test('invalid URL inputs match server rejection and do not get comparison keys', async ({
  page,
}) => {
  const invalid = [
    '',
    'example.com',
    '//example.com',
    'https:example.com',
    'javascript:alert(1)',
    'data:text/plain,a',
    'file:///tmp/a',
    'ftp://example.com',
    'chrome://settings',
    'about:blank',
    'https://user:password@example.com',
    'https://@example.com/',
    'https://',
    'https://exa mple.com',
    'https://-example.com',
    'https://example_.com',
    'https://example.com:99999',
    'https://example.com/\0',
    'https://example.com/\nsecret',
    'https://example.com/\\internal',
    'https://example.com/\ud800',
    'https://example.com/' + 'a'.repeat(2048),
    'https://example.com/' + '가'.repeat(300),
  ];
  expect(invalid.map(bookmarkComparisonKey)).toEqual(
    invalid.map(() => ({ kind: 'invalid' })),
  );
  expect(await compareInBrowser(page, invalid)).toEqual(
    invalid.map(() => ({ kind: 'invalid' })),
  );
});
test('duplicates keep first item and folder; existing and in-file reasons do not double count', () => {
  const bookmarks: ParsedBookmark[] = [
    'https://example.com/a#one',
    'https://example.com/a#two',
    'https://example.com/a?q=1',
  ].map((originalUrl, sourceIndex) => ({
    localId: `1:${sourceIndex}`,
    sourceIndex,
    originalUrl,
    originalTitle: '😀'.repeat(101),
    folderPath: [`folder ${sourceIndex}`],
    sourceDates: { addDate: null, lastModified: null, lastVisit: null },
  }));
  const items = compareExisting(
    buildImportItems(bookmarks),
    new Map([['https://example.com/a', 'existing-id']]),
  );
  expect(items.map((item) => item.eligibility)).toEqual([
    'duplicate_existing',
    'duplicate_in_file',
    'ready',
  ]);
  expect(items[1]).toMatchObject({
    duplicateOfLocalId: '1:0',
    folderPath: ['folder 1'],
  });
  expect(items[0]?.importTitle).toBe('😀'.repeat(100));
  expect(items[0]?.titleWarning).toBe(true);
  expect(bookmarks[0]?.originalUrl).toContain('#one');
});

test('1 MiB / 500 bookmarks remain bounded under simulated 4x CPU slowdown', async ({
  page,
  context,
}, info) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    const html = bookmarkHtml(500);
    const padded = html + ' '.repeat(1024 * 1024 - Buffer.byteLength(html));
    const result = await measureParser(page, padded);
    await info.attach('parser-performance', {
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
    mkdirSync('artifacts/wo-011-a', { recursive: true });
    writeFileSync(
      'artifacts/wo-011-a/parser-performance.json',
      JSON.stringify(
        { ...result, bytes: 1048576, bookmarks: 500, cpuSlowdown: 4 },
        null,
        2,
      ),
    );
    // Broad regression guard, not a promise about low-end mobile hardware.
    expect(result.maxMs).toBeLessThan(1000);
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
});
