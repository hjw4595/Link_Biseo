// Offline verification only: compiles pure normalizers, never boots Nest or a DB.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const backendPath = path.resolve(
  '../biseo_BE/apps/api/src/modules/sites/url-normalizer.ts',
);
function compile(
  file: string,
  resolve: (name: string) => unknown,
): Record<string, unknown> {
  const exports: Record<string, unknown> = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function('exports', 'require', js)(exports, resolve);
  return exports;
}
const backend = compile(backendPath, (name) => {
  if (name !== 'node:net') throw new Error('Unexpected backend dependency');
  return require(name);
});
const url = compile('src/lib/url.ts', () => {
  throw new Error('Unexpected URL dependency');
});
const frontend = compile(
  'src/features/bookmark-import/utils/detect-import-duplicates.ts',
  (name) => {
    if (name !== '../../../lib/url')
      throw new Error('Unexpected frontend dependency');
    return url;
  },
);
const normalize = backend.normalizeUrl;
const compare = frontend.bookmarkComparisonKey;
if (typeof normalize !== 'function' || typeof compare !== 'function')
  throw new Error('Missing normalizers');
// C reconstructed this corpus from backend spec literals and deterministic URL
// combinations. Freeze the inputs so later backend edits cannot silently change
// the comparison set. A retained only summary counts, not its original corpus.
const inputs: unknown = JSON.parse(
  fs.readFileSync('tests/fixtures/bookmarks/parity-cases.json', 'utf8'),
);
if (
  !Array.isArray(inputs) ||
  !inputs.every((value) => typeof value === 'string')
)
  throw new Error('Invalid parity corpus');
const values = new Set<string>(inputs);
let matched = 0,
  unverified = 0;
for (const input of values) {
  let expected: unknown;
  try {
    const result: unknown = normalize(input);
    expected =
      result && typeof result === 'object' && 'normalizedUrl' in result
        ? result.normalizedUrl
        : undefined;
  } catch {
    expected = null;
  }
  const actual: unknown = compare(input);
  if (!actual || typeof actual !== 'object' || !('kind' in actual))
    throw new Error('Invalid comparison result');
  if (actual.kind === 'comparison_unverified') {
    unverified++;
    continue;
  }
  if (
    expected === null
      ? actual.kind !== 'invalid'
      : !('key' in actual) || actual.key !== expected
  )
    throw new Error('Normalizer parity mismatch');
  matched++;
}
if (values.size !== 137) throw new Error('Unexpected corpus size');
fs.mkdirSync('artifacts/wo-011-c', { recursive: true });
fs.writeFileSync(
  'artifacts/wo-011-c/parity-cases.json',
  JSON.stringify([...values], null, 2),
);
const report = {
  cases: values.size,
  matched,
  unverified,
  sourceSha256: createHash('sha256')
    .update(fs.readFileSync(backendPath))
    .digest('hex'),
  networkRequests: 0,
  note: 'Reconstructed reproducible corpus; A retained counts/hash but not its original 137 inputs.',
};
fs.writeFileSync(
  'artifacts/wo-011-c/backend-parity.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
