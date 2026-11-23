'use client';
import { usageSummaryQueryKeys } from './keys';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { useDeviceDay } from '@/features/links/use-device-day';
import { createClient } from '@/lib/supabase/client';
import { getUsageSummary } from '@/lib/api/usage-summary';
export function useUsageSummary() {
  const { user } = useAuth();
  const deviceDay = useDeviceDay();
  const timeZone = deviceDay?.split('|')[0] ?? 'Asia/Seoul';
  return useQuery({
    queryKey: usageSummaryQueryKeys.usageSummary(user.id, timeZone, deviceDay),
    queryFn: ({ signal }) =>
      getUsageSummary(createClient(), user.id, timeZone, signal),
    enabled: deviceDay !== null,
    refetchOnWindowFocus: true,
  });
}
