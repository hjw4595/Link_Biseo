'use client';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  skipToken,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-provider';
import { useRequestScope } from '@/lib/query/provider';
import { usePreferences } from '@/lib/query/cleanup';
import { createClient } from '@/lib/supabase/client';
import { runOrganizationReport } from '@/lib/api/organization';
import { ApiRequestError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import {
  organizationRevision,
  type CachedOrganizationReport,
} from '@/lib/query/organization';
import { useDeviceDay } from '@/features/links/use-device-day';
import { deviceTimeZone } from '@/lib/time-zone';

export function deviceOrganizationTimeZone() {
  return deviceTimeZone();
}
function subscribeZone(notify: () => void) {
  window.addEventListener('focus', notify);
  document.addEventListener('visibilitychange', notify);
  return () => {
    window.removeEventListener('focus', notify);
    document.removeEventListener('visibilitychange', notify);
  };
}
export function useOrganizationReport({
  automatic = false,
}: { automatic?: boolean } = {}) {
  const { user } = useAuth();
  const cache = useQueryClient(),
    scope = useRequestScope();
  const timeZone = useSyncExternalStore(
    subscribeZone,
    deviceOrganizationTimeZone,
    () => null,
  );
  const preferences = usePreferences();
  const deviceDay = useDeviceDay();
  const revision =
    useQuery<number>({
      queryKey: queryKeys.organizationRevision(user.id),
      queryFn: skipToken,
      staleTime: Infinity,
    }).data ?? 0;
  const attempted = useRef<string | null>(null);
  const params = useSearchParams();
  const key = queryKeys.organizationReport(user.id, timeZone ?? 'Asia/Seoul');
  const mutationKey = [...queryKeys.organizationReports(user.id), 'run'];
  // Disabled cache observer: only an explicit mutation can POST.
  const result = useQuery<CachedOrganizationReport>({
    queryKey: key,
    queryFn: skipToken,
    staleTime: Infinity,
  });
  const pending = useIsMutating({ mutationKey }) > 0;
  const { mutate, error } = useMutation({
    mutationKey,
    retry: false,
    mutationFn: async (zone: string) => {
      const signal = scope(),
        revision = organizationRevision(cache, user.id);
      const report = await runOrganizationReport(
        createClient(),
        user.id,
        { timeZone: zone },
        signal,
      );
      if (signal.aborted) throw new ApiRequestError('aborted');
      return { report, revision, signal, zone };
    },
    onSuccess: ({ report, revision, signal, zone }) => {
      if (signal.aborted || scope().aborted) return;
      // An initial Home snapshot started before a completed write must not install ghost links.
      if (
        automatic &&
        organizationRevision(cache, user.id) !== revision &&
        !cache.getQueryData(queryKeys.organizationReport(user.id, zone))
      )
        return;
      cache.setQueryData<CachedOrganizationReport>(
        queryKeys.organizationReport(user.id, zone),
        (previous) => ({
          report,
          revision,
          stale: organizationRevision(cache, user.id) !== revision,
          ...(previous?.removedLinkIds
            ? { removedLinkIds: previous.removedLinkIds }
            : {}),
        }),
      );
    },
  });
  const run = useCallback(() => {
    if (
      timeZone &&
      cache.isMutating({
        mutationKey: [...queryKeys.organizationReports(user.id), 'run'],
      }) === 0
    ) {
      mutate(timeZone);
      return true;
    }
    return false;
  }, [cache, mutate, user.id, timeZone]);
  useEffect(() => {
    if (!timeZone) return;
    const url = new URL(window.location.href);
    if (
      url.pathname !== '/assistant/organization' ||
      url.searchParams.get('action') !== 'run'
    )
      return;
    url.searchParams.delete('action');
    window.history.replaceState(
      window.history.state,
      '',
      url.pathname + url.search + url.hash,
    );
    run();
  }, [params, timeZone, run]);
  const settingsChanged =
    !!result.data &&
    preferences.isSuccess &&
    !preferences.isFetching &&
    preferences.data.cleanupThresholdDays !==
      result.data.report.cleanupCandidates.thresholdDays;
  const stale = !!result.data?.stale || settingsChanged;
  const day = deviceDay?.split('|')[1];
  const needsReport =
    !result.data ||
    stale ||
    (day && result.data.report.cleanupCandidates.asOfDate !== day);
  const attemptKey = `${timeZone}|${day}|${revision}|${preferences.data?.cleanupThresholdDays}`;
  useEffect(() => {
    // Home opts in to a bounded read-only report, without changing manual report behavior.
    // A failed attempt waits for Retry or a real revision/day/preference change.
    if (
      !automatic ||
      !timeZone ||
      !day ||
      preferences.isPending ||
      pending ||
      !needsReport ||
      attempted.current === attemptKey
    )
      return;
    if (run()) attempted.current = attemptKey;
  }, [
    automatic,
    timeZone,
    day,
    preferences.isPending,
    pending,
    needsReport,
    attemptKey,
    run,
  ]);
  return {
    data: result.data,
    stale,
    error: automatic && !needsReport ? null : error,
    pending,
    run,
    ready: timeZone !== null,
  };
}
