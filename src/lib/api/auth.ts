import { isAuthMeResponse, type AuthMeResponse } from '@/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  authenticatedRequest,
  ApiRequestError,
  type ApiRequestErrorKind,
} from './client';
export { ApiRequestError as AuthApiError } from './client';
export type { ApiRequestErrorKind as AuthApiErrorKind } from './client';

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
  if (!response.ok) throw new ApiRequestError('invalid');
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiRequestError('invalid');
  }
  if (!isAuthMeResponse(body) || body.id !== expectedUserId)
    throw new ApiRequestError('invalid');
  return body;
}

export const authApiMessages: Record<ApiRequestErrorKind, string> = {
  unauthorized:
    'API에서 인증을 확인하지 못했어요. 다시 로그인하거나 잠시 후 재시도해 주세요.',
  forbidden: '이 API에 접근할 권한이 없어요.',
  network: 'API에 연결할 수 없어요. 네트워크를 확인하고 다시 시도해 주세요.',
  server: 'API가 일시적으로 응답하지 않아요. 로그인 상태는 유지돼요.',
  invalid: 'API 사용자 응답을 확인할 수 없어요.',
  timeout: '응답 시간이 초과됐어요. 다시 시도해 주세요.',
  aborted: '요청이 취소됐어요.',
  configuration: 'API 주소가 설정되지 않았어요.',
};
