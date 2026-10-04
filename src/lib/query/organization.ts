import type { QueryClient } from '@tanstack/react-query';
import type { OrganizationReport } from '@/contracts/organization-report';
import { queryKeys } from './keys';

export type CachedOrganizationReport = {
  report: OrganizationReport;
  stale: boolean;
  revision: number;
  /** Successful deletions must not reappear while a stale snapshot is retained. */
  removedLinkIds?: readonly string[];
};
export function organizationRevision(
  cache: QueryClient,
  userId: string,
): number {
  return (
    cache.getQueryData<number>(queryKeys.organizationRevision(userId)) ?? 0
  );
}
// Mark every cached zone without fetching. Revision also protects in-flight reports.
export function markOrganizationReportsStale(
  cache: QueryClient,
  userId: string,
  removedLinkId?: string,
) {
  cache.setQueryData(
    queryKeys.organizationRevision(userId),
    organizationRevision(cache, userId) + 1,
  );
  cache.setQueriesData<CachedOrganizationReport>(
    { queryKey: queryKeys.organizationReports(userId) },
    (previous) =>
      previous
        ? {
            ...previous,
            stale: true,
            ...(removedLinkId
              ? {
                  removedLinkIds: [
                    ...new Set([
                      ...(previous.removedLinkIds ?? []),
                      removedLinkId.toLowerCase(),
                    ]),
                  ],
                }
              : {}),
          }
        : previous,
  );
}
