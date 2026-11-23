import type { QueryClient } from '@tanstack/react-query';
import { usageSummaryQueryKeys } from './keys';

/** Batch writes mark stale; the next mount/focus fetches once. */
export function markUsageSummaryStale(cache: QueryClient, userId: string) {
  void cache.invalidateQueries({
    queryKey: usageSummaryQueryKeys.usageSummaries(userId),
    refetchType: 'none',
  });
}
