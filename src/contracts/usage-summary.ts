import { normalizeTimeZone } from '@/lib/time-zone';
export interface UsageSummaryResponse {
  recent7DayUsedLinkCount: number;
  recent7DayOpenCount: number;
  timezone: string;
  periodStartDate: string;
  periodEndDate: string;
  historyScope: 'currently_saved_links';
}
function isDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function isUsageSummaryResponse(
  value: unknown,
): value is UsageSummaryResponse {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'recent7DayUsedLinkCount' in value &&
    typeof value.recent7DayUsedLinkCount === 'number' &&
    Number.isSafeInteger(value.recent7DayUsedLinkCount) &&
    value.recent7DayUsedLinkCount >= 0 &&
    'recent7DayOpenCount' in value &&
    typeof value.recent7DayOpenCount === 'number' &&
    Number.isSafeInteger(value.recent7DayOpenCount) &&
    value.recent7DayOpenCount >= value.recent7DayUsedLinkCount &&
    'timezone' in value &&
    typeof value.timezone === 'string' &&
    normalizeTimeZone(value.timezone) !== null &&
    'periodStartDate' in value &&
    isDate(value.periodStartDate) &&
    'periodEndDate' in value &&
    isDate(value.periodEndDate) &&
    Date.parse(value.periodEndDate) - Date.parse(value.periodStartDate) ===
      6 * 86_400_000 &&
    'historyScope' in value &&
    value.historyScope === 'currently_saved_links'
  );
}
