import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { Page } from '@playwright/test';

// Compile the actual pure source for an isolated browser realm, not a second parser.
// This helper is test-only; no production debug exports or test routes are added.
function compile(file: string) {
  return ts.transpileModule(readFileSync(path.resolve(file), 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
}
export function bookmarkFixture(name: string) {
  return readFileSync(path.resolve('tests/fixtures/bookmarks', name), 'utf8');
}
export function bookmarkHtml(count: number) {
  return (
    '<!DOCTYPE NETSCAPE-Bookmark-file-1><H1>Bookmarks</H1><DL>' +
    Array.from(
      { length: count },
      (_, i) => `<DT><A HREF="https://import.example.test/${i}">링크 ${i}</A>`,
    ).join('') +
    '</DL>'
  );
}
export async function parseInBrowser(
  page: Page,
  html: string,
): Promise<unknown> {
  return page.evaluate(
    ({ code, html }) => {
      try {
        const result: unknown = new Function(
          'html',
          `const exports = {}; ${code}; return exports.parseBookmarkHtml(html, 7);`,
        )(html);
        return result;
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'unknown' };
      }
    },
    {
      code: compile(
        'src/features/bookmark-import/parser/parse-bookmark-html.ts',
      ),
      html,
    },
  );
}
export async function compareInBrowser(
  page: Page,
  inputs: string[],
): Promise<unknown> {
  return page.evaluate(
    ({ code, urlCode, inputs }) => {
      const result: unknown = new Function(
        'inputs',
        `const urlExports = {}; ((exports) => { ${urlCode} })(urlExports);
      const exports = {}; const require = () => urlExports; ${code}; return inputs.map(exports.bookmarkComparisonKey);`,
      )(inputs);
      return result;
    },
    {
      code: compile(
        'src/features/bookmark-import/utils/detect-import-duplicates.ts',
      ),
      urlCode: compile('src/lib/url.ts'),
      inputs,
    },
  );
}

export async function measureParser(page: Page, html: string) {
  return page.evaluate(
    ({ code, html }) => {
      const parse = new Function(
        'html',
        `const exports = {}; ${code}; return exports.parseBookmarkHtml(html, 1);`,
      );
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const result: unknown = parse(html);
        if (!Array.isArray(result) || result.length !== 500)
          throw new Error('Incomplete benchmark parse');
        samples.push(performance.now() - start);
      }
      return { samplesMs: samples, maxMs: Math.max(...samples) };
    },
    {
      code: compile(
        'src/features/bookmark-import/parser/parse-bookmark-html.ts',
      ),
      html,
    },
  );
}
