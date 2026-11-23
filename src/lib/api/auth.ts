import { readJsonResponse } from './response';
import { isAuthMeResponse, type AuthMeResponse } from '@/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticatedRequest, ApiRequestError } from './client';

export async function getAuthMe(
  client: SupabaseClient,
  expectedUserId: string,
  signal?: AbortSignal,
): Promise<AuthMeResponse> {
  const response = await authenticatedRequest(
    client,
    expectedUserId,
    '/auth/me',
    { signal },
  );
  const body = await readJsonResponse(response, isAuthMeResponse);
  if (body.id !== expectedUserId) throw new ApiRequestError('invalid');
  return body;
}
