import { normalizeTimeZone } from '@/lib/time-zone';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticatedRequest, ApiRequestError } from './client';
import { isUsageSummaryResponse } from '@/contracts/usage-summary';
export async function getUsageSummary(
  client: SupabaseClient,
  userId: string,
  timeZone: string,
  signal: AbortSignal,
) {
  const response = await authenticatedRequest(
    client,
    userId,
    '/users/me/usage-summary',
    { query: { timeZone }, signal },
  );
  if (!response.ok) throw new ApiRequestError('invalid', response.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiRequestError('invalid');
  }
  if (
    !isUsageSummaryResponse(body) ||
    normalizeTimeZone(body.timezone) !== normalizeTimeZone(timeZone)
  )
    throw new ApiRequestError('invalid');
  return body;
}
