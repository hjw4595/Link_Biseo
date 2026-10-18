import type { ListLinksResponse } from '../../contracts/links';
import { bookmarkComparisonKey } from './utils/detect-import-duplicates';

export class ExistingScanError extends Error {
  constructor(
    public readonly reason: 'cursor' | 'limit' | 'invalid' | 'timeout',
  ) {
    super(reason);
  }
}

export const SCAN_TIMEOUT_MS = 30_000;
export async function scanExistingLinks(
  loadPage: (
    cursor: string | undefined,
    signal: AbortSignal,
  ) => Promise<ListLinksResponse>,
  signal: AbortSignal,
): Promise<{ index: Map<string, string>; count: number }> {
  const deadline = AbortSignal.timeout(SCAN_TIMEOUT_MS);
  const combined = AbortSignal.any([signal, deadline]);
  const index = new Map<string, string>();
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    combined.throwIfAborted();
    // A deadline races the entire loader (including SDK/auth and body parsing),
    // rather than relying only on fetch's shorter per-request timeout.
    const result = await abortable(loadPage(cursor, combined), combined);
    combined.throwIfAborted();
    if (result.items.length > 100) throw new ExistingScanError('invalid');
    for (const link of result.items) {
      const comparison = bookmarkComparisonKey(link.url);
      if (comparison.kind === 'invalid') throw new ExistingScanError('invalid');
      // Unverified imported URLs are never selectable, so need no index entry.
      if (comparison.kind === 'verified') {
        const prior = index.get(comparison.key);
        if (prior && prior !== link.id) throw new ExistingScanError('invalid');
        index.set(comparison.key, link.id);
      }
      ids.add(link.id);
      if (ids.size > 5000) throw new ExistingScanError('limit');
    }
    if (result.nextCursor === null) return { index, count: ids.size };
    if (!result.items.length || cursors.has(result.nextCursor))
      throw new ExistingScanError('cursor');
    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new ExistingScanError('limit');
}

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new ExistingScanError('timeout'));
    if (signal.aborted) {
      abort();
    } else signal.addEventListener('abort', abort, { once: true });
    void work.then(
      (result) => {
        signal.removeEventListener('abort', abort);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}
