'use client';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { useDeviceDay } from '@/features/links/use-device-day';
import { createClient } from '@/lib/supabase/client';
import { getUsageSummary } from '@/lib/api/usage-summary';
import { queryKeys } from './keys';
export function useUsageSummary() {
  const { user } = useAuth();
  const deviceDay = useDeviceDay();
  const timeZone = deviceDay?.split('|')[0] ?? 'Asia/Seoul';
  return useQuery({
    queryKey: queryKeys.usageSummary(user.id, timeZone, deviceDay),
    queryFn: ({ signal }) =>
      getUsageSummary(createClient(), user.id, timeZone, signal),
    enabled: deviceDay !== null,
    refetchOnWindowFocus: true,
  });
}
/** Batch Open/import writes only mark stale; next mount/focus fetches once. Never delays opening links. */
export function markUsageSummaryStale(cache: QueryClient, userId: string) {
  void cache.invalidateQueries({
    queryKey: queryKeys.usageSummaries(userId),
    refetchType: 'none',
  });
}
