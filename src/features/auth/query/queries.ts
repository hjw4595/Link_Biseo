'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth-provider';
import { createClient } from '@/lib/supabase/client';
import { getAuthMe } from '@/lib/api/auth';
import { authQueryKeys } from './keys';

export function useAccount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: authQueryKeys.auth(user.id),
    queryFn: ({ signal }) => getAuthMe(createClient(), user.id, signal),
  });
}
