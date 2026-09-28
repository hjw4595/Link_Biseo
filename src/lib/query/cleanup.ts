'use client';
import { useEffect } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { preferences, cleanupCandidates } from '@/lib/api/cleanup';
import { ApiRequestError } from '@/lib/api/client';
import type { CleanupThreshold } from '@/contracts/cleanup';
import { queryKeys } from './keys';
import { useRequestScope } from './provider';
import { markOrganizationReportsStale } from './organization';
export function usePreferences() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.preferences(user.id),
    queryFn: ({ signal }) => preferences(createClient(), user.id, signal),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  useResumeRefresh(query.refetch, true);
  return query;
}
function useResumeRefresh(
  refetch: (options: { cancelRefetch: boolean }) => Promise<unknown>,
  enabled: boolean,
) {
  useEffect(() => {
    const resume = () => {
      if (enabled && document.visibilityState === 'visible')
        void refetch({ cancelRefetch: false });
    };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [refetch, enabled]);
}
export function useCleanup(
  day: string | null,
  threshold: CleanupThreshold | undefined,
) {
  const { user } = useAuth();
  const query = useInfiniteQuery({
    queryKey: [...queryKeys.cleanup(user.id), day, threshold],
    enabled: day !== null && threshold !== null && threshold !== undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) =>
      cleanupCandidates(
        createClient(),
        user.id,
        day?.split('|')[0] ?? 'UTC',
        signal,
        pageParam,
      ),
    getNextPageParam: (last, _pages, previous, params) =>
      last.nextCursor &&
      last.nextCursor !== previous &&
      !params.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  useResumeRefresh(
    query.refetch,
    day !== null && threshold !== null && threshold !== undefined,
  );
  return query;
}
export function usePreferenceMutation() {
  const { user } = useAuth(),
    cache = useQueryClient(),
    scope = useRequestScope();
  return useMutation({
    mutationFn: (cleanupThresholdDays: CleanupThreshold) =>
      preferences(createClient(), user.id, scope(), { cleanupThresholdDays }),
    onSuccess: async (data) => {
      if (scope().aborted) throw new ApiRequestError('aborted');
      markOrganizationReportsStale(cache, user.id);
      await cache.cancelQueries({ queryKey: queryKeys.preferences(user.id) });
      if (scope().aborted) throw new ApiRequestError('aborted');
      cache.setQueryData(queryKeys.preferences(user.id), data);
      await cache.invalidateQueries({ queryKey: queryKeys.cleanup(user.id) });
    },
  });
}
