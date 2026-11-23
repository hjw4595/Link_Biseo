import { organizationQueryKeys } from './keys';
import type { QueryClient } from '@tanstack/react-query';
import type { OrganizationReport } from '@/contracts/organization-report';

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
    cache.getQueryData<number>(
      organizationQueryKeys.organizationRevision(userId),
    ) ?? 0
  );
}
// Mark every cached zone without fetching. Revision also protects in-flight reports.
export function markOrganizationReportsStale(
  cache: QueryClient,
  userId: string,
  removedLinkId?: string,
) {
  cache.setQueryData(
    organizationQueryKeys.organizationRevision(userId),
    organizationRevision(cache, userId) + 1,
  );
  cache.setQueriesData<CachedOrganizationReport>(
    { queryKey: organizationQueryKeys.organizationReports(userId) },
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
