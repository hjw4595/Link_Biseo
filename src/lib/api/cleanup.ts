import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticatedRequest, ApiRequestError } from './client';
import { LinkApiError } from './links';
import {
  isCleanupResponse,
  isUserPreferences,
  type CleanupThreshold,
} from '@/contracts/cleanup';
async function checked<T>(
  response: Response,
  validate: (v: unknown) => v is T,
) {
  if (!response.ok) throw new LinkApiError(response.status);
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ApiRequestError('invalid');
  }
  if (!validate(value)) throw new ApiRequestError('invalid');
  return value;
}
export async function preferences(
  client: SupabaseClient,
  userId: string,
  signal: AbortSignal,
  value?: { cleanupThresholdDays: CleanupThreshold },
) {
  return checked(
    await authenticatedRequest(client, userId, '/users/me/preferences', {
      signal,
      ...(value ? { method: 'PATCH', body: value } : {}),
    }),
    isUserPreferences,
  );
}
export async function cleanupCandidates(
  client: SupabaseClient,
  userId: string,
  timeZone: string,
  signal: AbortSignal,
  cursor?: string,
) {
  return checked(
    await authenticatedRequest(client, userId, '/links/cleanup', {
      query: { timeZone, cursor, limit: 10 },
      signal,
    }),
    isCleanupResponse,
  );
}
