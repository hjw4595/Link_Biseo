import type { QueryClient } from '@tanstack/react-query';
import { markOrganizationReportsStale } from '@/features/organization/query/cache';
import { markUsageSummaryStale } from '@/features/settings/query/cache';
import { linkQueryKeys } from './keys';

/** Also used for uncertain import writes; neither summary triggers a request. */
export function markLinkSummariesStale(
  cache: QueryClient,
  userId: string,
  removedLinkId?: string,
) {
  markOrganizationReportsStale(cache, userId, removedLinkId);
  markUsageSummaryStale(cache, userId);
}

/** Refresh active lists together; callers decide whether to await completion. */
export async function refreshLinkLists(cache: QueryClient, userId: string) {
  await Promise.all([
    cache.invalidateQueries({ queryKey: linkQueryKeys.lists(userId) }),
    cache.invalidateQueries({ queryKey: linkQueryKeys.cleanup(userId) }),
  ]);
}

/** A confirmed Open never waits for GETs or turns their failure into a failed POST. */
export function refreshOpenedLink(
  cache: QueryClient,
  userId: string,
  linkId: string,
) {
  markLinkSummariesStale(cache, userId);
  void Promise.all([
    cache.invalidateQueries({ queryKey: linkQueryKeys.stats(userId, linkId) }),
    cache.invalidateQueries({ queryKey: linkQueryKeys.detail(userId, linkId) }),
    refreshLinkLists(cache, userId),
  ]).catch(() => {});
}
