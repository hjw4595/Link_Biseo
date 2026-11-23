import type { LinkFilters } from '@/contracts/links';
export const linkQueryKeys = {
  preferences: (userId: string) => [userId, 'preferences'] as const,
  cleanup: (userId: string) => [userId, 'cleanup'] as const,
  links: (userId: string) => [userId, 'links'] as const,
  linkPreview: (userId: string, url: string | null) =>
    [userId, 'link-preview', url] as const,
  lists: (userId: string) => [userId, 'links', 'list'] as const,
  list: (userId: string, filters: LinkFilters) =>
    [userId, 'links', 'list', filters] as const,
  detail: (userId: string, id: string) =>
    [userId, 'links', 'detail', id] as const,
  stats: (userId: string, id: string) =>
    [userId, 'links', 'stats', id] as const,
  dailyStats: (
    userId: string,
    id: string,
    day: string | null,
    timeZone = 'Asia/Seoul',
  ) => [userId, 'links', 'stats', id, timeZone, day] as const,
};
