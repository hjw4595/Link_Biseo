import {
  isLinkResponse,
  isTimestamp,
  isUuid,
  type LinkResponse,
} from './links';
import { isCleanupThreshold, type CleanupThreshold } from './cleanup';

// Public transport contract checked against biseo_BE WO-05.1, 2026-10-23.
export interface OrganizationReportRequest {
  timeZone?: string;
}
export interface OrganizationCategory {
  id: string;
  name: string;
  linkCount: number;
}
export interface ReportSection<T> {
  totalCount: number;
  items: T[];
  truncated: boolean;
}
export type OrganizationCleanupLink = LinkResponse & { unusedDays: number };
export interface OrganizationReport {
  asOf: string;
  timeZone: string;
  summary: {
    totalLinks: number;
    totalCategories: number;
    uncategorizedCount: number;
    cleanupCandidateCount: number;
    metadataFailedCount: number;
  };
  categories: OrganizationCategory[];
  uncategorized: ReportSection<LinkResponse>;
  recentlyAdded: ReportSection<LinkResponse>;
  cleanupCandidates: ReportSection<OrganizationCleanupLink> & {
    thresholdDays: CleanupThreshold;
    asOfDate: string;
  };
  metadataFailures: ReportSection<LinkResponse>;
  semantics: { status: 'not_included' };
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function normalizeOrganizationTimeZone(v: unknown): string | null {
  if (
    typeof v !== 'string' ||
    v.length > 100 ||
    !/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(v)
  )
    return null;
  try {
    return new Intl.DateTimeFormat('en', { timeZone: v }).resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}
function date(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
function category(v: unknown): v is OrganizationCategory {
  return (
    record(v) &&
    isUuid(v.id) &&
    typeof v.name === 'string' &&
    count(v.linkCount)
  );
}
function cleanupLink(v: unknown): v is OrganizationCleanupLink {
  return (
    isLinkResponse(v) &&
    'unusedDays' in v &&
    count(v.unusedDays) &&
    !v.isFavorite
  );
}
function section<T extends LinkResponse>(
  v: unknown,
  item: (input: unknown) => input is T,
): v is ReportSection<T> {
  return (
    record(v) &&
    count(v.totalCount) &&
    Array.isArray(v.items) &&
    v.items.length <= 10 &&
    v.items.length <= v.totalCount &&
    v.items.every(item) &&
    typeof v.truncated === 'boolean' &&
    v.truncated === v.totalCount > v.items.length &&
    new Set(v.items.map((link) => link.id.toLowerCase())).size ===
      v.items.length
  );
}
export function isOrganizationReport(v: unknown): v is OrganizationReport {
  if (
    !record(v) ||
    !isTimestamp(v.asOf) ||
    normalizeOrganizationTimeZone(v.timeZone) === null ||
    !record(v.summary) ||
    !Array.isArray(v.categories) ||
    !v.categories.every(category) ||
    !section(v.uncategorized, isLinkResponse) ||
    !section(v.recentlyAdded, isLinkResponse) ||
    !section(v.metadataFailures, isLinkResponse) ||
    !record(v.cleanupCandidates) ||
    !section(v.cleanupCandidates, cleanupLink) ||
    !isCleanupThreshold(v.cleanupCandidates.thresholdDays) ||
    !date(v.cleanupCandidates.asOfDate) ||
    !record(v.semantics) ||
    v.semantics.status !== 'not_included'
  )
    return false;
  const summary = v.summary,
    cleanup = v.cleanupCandidates;
  if (
    !count(summary.totalLinks) ||
    !count(summary.totalCategories) ||
    !count(summary.uncategorizedCount) ||
    !count(summary.cleanupCandidateCount) ||
    !count(summary.metadataFailedCount)
  )
    return false;
  const totalLinks = summary.totalLinks;
  const categoryIds = new Set(
    v.categories.map((item) => item.id.toLowerCase()),
  );
  const categoryLinks = v.categories.reduce(
    (sum, item) => sum + item.linkCount,
    0,
  );
  return (
    categoryIds.size === v.categories.length &&
    summary.totalCategories === v.categories.length &&
    Number.isSafeInteger(categoryLinks) &&
    categoryLinks + summary.uncategorizedCount === summary.totalLinks &&
    v.uncategorized.totalCount === summary.uncategorizedCount &&
    cleanup.totalCount === summary.cleanupCandidateCount &&
    v.metadataFailures.totalCount === summary.metadataFailedCount &&
    v.recentlyAdded.totalCount === summary.totalLinks &&
    [v.uncategorized, v.recentlyAdded, cleanup, v.metadataFailures].every(
      (value) =>
        value.totalCount <= totalLinks &&
        value.items.every(
          (link) =>
            link.categoryId === null ||
            categoryIds.has(link.categoryId.toLowerCase()),
        ),
    ) &&
    v.uncategorized.items.every((link) => link.categoryId === null) &&
    (cleanup.thresholdDays === null
      ? cleanup.totalCount === 0
      : cleanup.items.every(
          (link) => link.unusedDays >= Number(cleanup.thresholdDays),
        ))
  );
}
