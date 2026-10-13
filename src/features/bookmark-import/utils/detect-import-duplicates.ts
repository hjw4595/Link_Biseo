import { safeExternalUrl } from '../../../lib/url';
import type { ImportItem, ParsedBookmark } from '../types';

type Comparison =
  | { kind: 'invalid' | 'comparison_unverified' }
  | { kind: 'verified'; key: string; domain: string; hasHash: boolean };

// Mirrored from biseo_BE url-normalizer.ts (2026-10-26). No DNS/network.
// IPv6 is deliberately unverified: this browser utility does not replace node:net.isIP.
export function bookmarkComparisonKey(input: string): Comparison {
  try {
    if (
      input.length > 2048 ||
      input.includes('\\') ||
      [...input].some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      )
    )
      return { kind: 'invalid' };
    encodeURIComponent(input);
    const raw = input.trim();
    if (
      !/^https?:\/\//i.test(raw) ||
      raw.split('://')[1]?.split(/[/?#]/)[0]?.includes('@')
    )
      return { kind: 'invalid' };
    const url = safeExternalUrl(raw);
    if (!url || !url.hostname || url.hostname.length > 255)
      return { kind: 'invalid' };
    const dnsLabel =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*\.?$/i;
    const hasHash = raw.includes('#');
    url.hash = '';
    if (url.href.length > 2048) return { kind: 'invalid' };
    if (url.hostname.startsWith('[')) return { kind: 'comparison_unverified' };
    if (!dnsLabel.test(url.hostname)) return { kind: 'invalid' };
    return { kind: 'verified', key: url.href, domain: url.hostname, hasHash };
  } catch {
    return { kind: 'invalid' };
  }
}

export function buildImportItems(bookmarks: ParsedBookmark[]): ImportItem[] {
  const first = new Map<string, string>();
  return bookmarks.map((bookmark) => {
    const comparison = bookmarkComparisonKey(bookmark.originalUrl);
    const trimmed = bookmark.originalTitle.trim();
    let importTitle: string | null = null;
    try {
      encodeURIComponent(trimmed);
      if (!trimmed.includes('\0')) {
        let title = '';
        for (const char of trimmed) {
          if (title.length + char.length > 200) break;
          title += char;
        }
        importTitle = title || null;
      }
    } catch {
      /* Invalid Unicode titles remain visible but will not be submitted. */
    }
    const base = {
      ...bookmark,
      importTitle,
      titleWarning: importTitle !== (trimmed || null),
      comparisonKey: comparison.kind === 'verified' ? comparison.key : null,
      domain: comparison.kind === 'verified' ? comparison.domain : null,
      hasHash: bookmark.originalUrl.includes('#'),
    };
    if (comparison.kind !== 'verified')
      return { ...base, eligibility: comparison.kind };
    const duplicateOfLocalId = first.get(comparison.key);
    if (duplicateOfLocalId)
      return { ...base, eligibility: 'duplicate_in_file', duplicateOfLocalId };
    first.set(comparison.key, bookmark.localId);
    return { ...base, eligibility: 'ready' };
  });
}

export function compareExisting(
  items: ImportItem[],
  index: Map<string, string>,
): ImportItem[] {
  return items.map((item) => {
    if (item.eligibility !== 'ready' || item.comparisonKey === null)
      return item;
    const existingLinkId = index.get(item.comparisonKey);
    return existingLinkId
      ? { ...item, eligibility: 'duplicate_existing', existingLinkId }
      : item;
  });
}
