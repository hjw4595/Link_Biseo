import type { LinkFilters } from '@/contracts/links';
export const queryKeys = {
  usageSummaries: (userId: string) => [userId, 'usage-summary'] as const,
  usageSummary: (userId: string, timeZone: string, deviceDay: string | null) =>
    [userId, 'usage-summary', timeZone, deviceDay] as const,
  presets: (userId: string) => [userId, 'quick-launch-presets'] as const,
  presetList: (userId: string) =>
    [userId, 'quick-launch-presets', 'list'] as const,
  preset: (userId: string, id: string) =>
    [userId, 'quick-launch-presets', 'detail', id] as const,
  organizationReports: (userId: string) =>
    [userId, 'organization-reports'] as const,
  organizationReport: (userId: string, timeZone: string) =>
    [userId, 'organization-reports', timeZone] as const,
  organizationRevision: (userId: string) =>
    [userId, 'organization-revision'] as const,
  preferences: (userId: string) => [userId, 'preferences'] as const,
  cleanup: (userId: string) => [userId, 'cleanup'] as const,
  categories: (userId: string) => [userId, 'categories'] as const,
  categorySummary: (userId: string) =>
    [userId, 'categories', 'summary'] as const,
  links: (userId: string) => [userId, 'links'] as const,
  linkPreview: (userId: string, url: string | null) =>
    [userId, 'link-preview', url] as const,
  lists: (userId: string) => [userId, 'links', 'list'] as const,
  list: (userId: string, filters: LinkFilters) =>
    [userId, 'links', 'list', filters] as const,
  detail: (userId: string, id: string) =>
    [userId, 'links', 'detail', id] as const,
  auth: (userId: string) => [userId, 'auth'] as const,
  stats: (userId: string, id: string) =>
    [userId, 'links', 'stats', id] as const,
  dailyStats: (
    userId: string,
    id: string,
    day: string | null,
    timeZone = 'Asia/Seoul',
  ) => [userId, 'links', 'stats', id, timeZone, day] as const,
};
