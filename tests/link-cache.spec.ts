import { expect, test } from '@playwright/test';
import {
  QueryClient,
  QueryObserver,
  type QueryKey,
} from '@tanstack/react-query';
import {
  markLinkSummariesStale,
  refreshLinkLists,
  refreshOpenedLink,
} from '../src/features/links/query/cache';
import { linkQueryKeys } from '../src/features/links/query/keys';
import { categoryQueryKeys } from '../src/features/categories/query/keys';
import { presetQueryKeys } from '../src/features/quick-launch/query/keys';
import { usageSummaryQueryKeys } from '../src/features/settings/query/keys';
import { organizationQueryKeys } from '../src/features/organization/query/keys';
import type { CachedOrganizationReport } from '../src/features/organization/query/cache';
import { organizationReport } from './organization-report-data';
import { initialProduct } from './product-fixture';

function observe(
  cache: QueryClient,
  key: QueryKey,
  queryFn: () => Promise<number>,
) {
  cache.setQueryData(key, 0);
  const observer = new QueryObserver(cache, {
    queryKey: key,
    queryFn,
    staleTime: Infinity,
    retry: false,
  });
  return observer.subscribe(() => {});
}

test('confirmed Open refreshes only its owner and link, without waiting for GETs or fetching summaries', async () => {
  const cache = new QueryClient();
  let release: (value: number) => void = () => {};
  const response = new Promise<number>((resolve) => {
    release = resolve;
  });
  const requests: QueryKey[] = [];
  const affected = [
    linkQueryKeys.dailyStats('A', 'link', '2026-11-20', 'UTC'),
    linkQueryKeys.detail('A', 'link'),
    linkQueryKeys.list('A', {}),
    [...linkQueryKeys.cleanup('A'), 'UTC|2026-11-20', 14],
  ];
  const untouched = [
    linkQueryKeys.detail('A', 'other-link'),
    linkQueryKeys.detail('B', 'link'),
    linkQueryKeys.list('B', {}),
    categoryQueryKeys.categorySummary('A'),
    presetQueryKeys.presetList('A'),
    linkQueryKeys.preferences('A'),
    usageSummaryQueryKeys.usageSummary('B', 'UTC', '2026-11-20'),
  ];
  const usage = usageSummaryQueryKeys.usageSummary('A', 'UTC', '2026-11-20');
  const unsubscribes = [...affected, ...untouched, usage].map((key) =>
    observe(cache, key, () => {
      requests.push(key);
      return response;
    }),
  );
  try {
    expect(refreshOpenedLink(cache, 'A', 'link')).toBeUndefined();
    expect(requests).toEqual(affected);
    expect(cache.isFetching()).toBe(affected.length);
    expect(cache.getQueryState(usage)?.isInvalidated).toBe(true);
    for (const key of untouched)
      expect(cache.getQueryState(key)?.isInvalidated).toBe(false);
    release(1);
    await expect.poll(() => cache.isFetching()).toBe(0);
  } finally {
    release(1);
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    cache.clear();
  }
});

test('summary marking during a batch retains report snapshots and deletions without any GETs', () => {
  const cache = new QueryClient();
  const report = organizationReport(initialProduct());
  for (const owner of ['A', 'B'])
    for (const zone of ['UTC', 'Asia/Seoul'])
      cache.setQueryData<CachedOrganizationReport>(
        organizationQueryKeys.organizationReport(owner, zone),
        { report, stale: false, revision: 0 },
      );
  let gets = 0;
  const usage = usageSummaryQueryKeys.usageSummary('A', 'UTC', '2026-11-20');
  const unsubscribe = observe(cache, usage, async () => ++gets);
  try {
    markLinkSummariesStale(cache, 'A', 'deleted-link');
    markLinkSummariesStale(cache, 'A'); // A subsequent imported/unknown write.
    expect(gets).toBe(0);
    expect(cache.getQueryState(usage)?.isInvalidated).toBe(true);
    for (const zone of ['UTC', 'Asia/Seoul']) {
      expect(
        cache.getQueryData<CachedOrganizationReport>(
          organizationQueryKeys.organizationReport('A', zone),
        ),
      ).toMatchObject({
        report,
        stale: true,
        removedLinkIds: ['deleted-link'],
      });
      expect(
        cache.getQueryData<CachedOrganizationReport>(
          organizationQueryKeys.organizationReport('B', zone),
        )?.stale,
      ).toBe(false);
    }
  } finally {
    unsubscribe();
    cache.clear();
  }
});

test('failed background refresh does not fail a confirmed Open; batch completion can await list refresh', async () => {
  const cache = new QueryClient();
  const key = linkQueryKeys.list('A', {});
  const unsubscribe = observe(cache, key, async () => {
    throw new Error('GET unavailable after a committed POST');
  });
  try {
    expect(refreshOpenedLink(cache, 'A', 'link')).toBeUndefined();
    await expect.poll(() => cache.getQueryState(key)?.status).toBe('error');
    await expect(refreshLinkLists(cache, 'A')).resolves.toBeUndefined();
    expect(cache.getQueryData(key)).toBe(0);
  } finally {
    unsubscribe();
    cache.clear();
  }
});
