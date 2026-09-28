import { isLinkResponse, isTimestamp, type LinkResponse } from './links';
export type CleanupThreshold = 7 | 14 | 30 | null;
export interface UserPreferences {
  cleanupThresholdDays: CleanupThreshold;
}
export interface CleanupResponse {
  thresholdDays: CleanupThreshold;
  timeZone: string;
  asOfDate: string;
  serverNow: string;
  totalCount: number;
  items: (LinkResponse & { unusedDays: number })[];
  nextCursor: string | null;
}
export const isCleanupThreshold = (v: unknown): v is CleanupThreshold =>
  v === null || v === 7 || v === 14 || v === 30;
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export function isUserPreferences(v: unknown): v is UserPreferences {
  return record(v) && isCleanupThreshold(v.cleanupThresholdDays);
}
export function isCleanupResponse(v: unknown): v is CleanupResponse {
  return (
    record(v) &&
    isCleanupThreshold(v.thresholdDays) &&
    typeof v.timeZone === 'string' &&
    typeof v.asOfDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.asOfDate) &&
    isTimestamp(v.serverNow) &&
    typeof v.totalCount === 'number' &&
    Number.isSafeInteger(v.totalCount) &&
    v.totalCount >= 0 &&
    Array.isArray(v.items) &&
    v.items.length <= v.totalCount &&
    v.items.every(
      (item) =>
        isLinkResponse(item) &&
        !item.isFavorite &&
        'unusedDays' in item &&
        typeof item.unusedDays === 'number' &&
        Number.isSafeInteger(item.unusedDays) &&
        v.thresholdDays !== null &&
        item.unusedDays >= Number(v.thresholdDays),
    ) &&
    (v.nextCursor === null ||
      (typeof v.nextCursor === 'string' &&
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.nextCursor) &&
        v.nextCursor.length <= 512)) &&
    (v.thresholdDays !== null ||
      (v.totalCount === 0 && v.items.length === 0 && v.nextCursor === null))
  );
}
