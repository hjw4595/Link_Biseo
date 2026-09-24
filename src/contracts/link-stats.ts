import { isTimestamp, isUuid } from './links';
import { normalizeTimeZone } from '@/lib/time-zone';
export interface LinkStatsResponse {
  linkId: string;
  createdAt: string;
  lastOpenedAt: string | null;
  recent7DayOpenCount: number;
  timezone: string;
  periodStartDate: string;
  periodEndDate: string;
  historyStatus: 'complete' | 'partial';
}
function isDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function isLinkStatsResponse(
  value: unknown,
): value is LinkStatsResponse {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'linkId' in value &&
    isUuid(value.linkId) &&
    'createdAt' in value &&
    isTimestamp(value.createdAt) &&
    'lastOpenedAt' in value &&
    (value.lastOpenedAt === null || isTimestamp(value.lastOpenedAt)) &&
    'recent7DayOpenCount' in value &&
    typeof value.recent7DayOpenCount === 'number' &&
    Number.isSafeInteger(value.recent7DayOpenCount) &&
    value.recent7DayOpenCount >= 0 &&
    'timezone' in value &&
    normalizeTimeZone(value.timezone) !== null &&
    'historyStatus' in value &&
    (value.historyStatus === 'complete' || value.historyStatus === 'partial') &&
    'periodStartDate' in value &&
    isDate(value.periodStartDate) &&
    'periodEndDate' in value &&
    isDate(value.periodEndDate) &&
    Date.parse(value.periodEndDate) - Date.parse(value.periodStartDate) ===
      6 * 86_400_000
  );
}
