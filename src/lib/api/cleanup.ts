import { readJsonResponse } from './response';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticatedRequest } from './client';
import {
  isCleanupResponse,
  isUserPreferences,
  type CleanupThreshold,
} from '@/contracts/cleanup';
export async function preferences(
  client: SupabaseClient,
  userId: string,
  signal: AbortSignal,
  value?: { cleanupThresholdDays: CleanupThreshold },
) {
  return readJsonResponse(
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
  return readJsonResponse(
    await authenticatedRequest(client, userId, '/links/cleanup', {
      query: { timeZone, cursor, limit: 10 },
      signal,
    }),
    isCleanupResponse,
  );
}
