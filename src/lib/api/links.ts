import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticatedRequest, ApiRequestError } from './client';
import { safeExternalUrl } from '@/lib/url';
import { isLinkStatsResponse } from '@/contracts/link-stats';
import { normalizeTimeZone } from '@/lib/time-zone';
import {
  isLinkResponse,
  isLinkPreviewResponse,
  isListLinksResponse,
  isOpenLinkResponse,
  type LinkFilters,
  type CreateLinkRequest,
  type UpdateLinkRequest,
} from '@/contracts/links';

export class LinkApiError extends Error {
  constructor(public readonly status: number) {
    super('Link request failed');
  }
}
export function linkErrorMessage(error: unknown): string {
  if (error instanceof LinkApiError) {
    if (error.status === 400) return '입력값이나 목록 조건을 확인해 주세요.';
    if (error.status === 404) return '링크 또는 카테고리를 찾을 수 없어요.';
    if (error.status === 409)
      return '이미 저장한 링크예요. 입력한 내용은 유지돼요.';
  }
  if (error instanceof ApiRequestError) {
    if (error.kind === 'unauthorized')
      return '로그인 상태를 확인할 수 없어요. 다시 로그인해 주세요.';
    if (error.kind === 'forbidden') return '접근 권한이 없어요.';
    if (error.kind === 'invalid') return '서버 응답을 확인할 수 없어요.';
    if (error.kind === 'timeout')
      return '응답 시간이 초과됐어요. 목록을 확인한 후 다시 시도해 주세요.';
    if (error.kind === 'network')
      return '연결하지 못했어요. 네트워크를 확인해 주세요.';
  }
  return '처리하지 못했어요. 다시 시도해 주세요.';
}
async function checked<T>(
  response: Response,
  validate: (value: unknown) => value is T,
): Promise<T> {
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
export async function listLinks(
  client: SupabaseClient,
  userId: string,
  filters: LinkFilters,
  cursor?: string,
  signal?: AbortSignal,
) {
  return checked(
    await authenticatedRequest(client, userId, '/links', {
      query: { ...filters, cursor },
      signal,
    }),
    isListLinksResponse,
  );
}
export async function previewLink(
  client: SupabaseClient,
  userId: string,
  url: string,
  signal?: AbortSignal,
) {
  const result = await checked(
    await authenticatedRequest(client, userId, '/links/preview', {
      method: 'POST',
      body: { url },
      signal,
    }),
    isLinkPreviewResponse,
  );
  if (result.url !== url) throw new ApiRequestError('invalid');
  return result;
}
export async function getLink(
  client: SupabaseClient,
  userId: string,
  id: string,
  signal?: AbortSignal,
) {
  return checked(
    await authenticatedRequest(
      client,
      userId,
      `/links/${encodeURIComponent(id)}`,
      { signal },
    ),
    isLinkResponse,
  );
}
export async function getLinkStats(
  client: SupabaseClient,
  userId: string,
  id: string,
  signal?: AbortSignal,
  timeZone = 'Asia/Seoul',
) {
  const result = await checked(
    await authenticatedRequest(
      client,
      userId,
      `/links/${encodeURIComponent(id)}/stats`,
      { signal, query: { timeZone } },
    ),
    isLinkStatsResponse,
  );
  if (
    result.linkId.toLowerCase() !== id.toLowerCase() ||
    normalizeTimeZone(result.timezone) !== normalizeTimeZone(timeZone)
  )
    throw new ApiRequestError('invalid');
  return result;
}
export async function saveLink(
  client: SupabaseClient,
  userId: string,
  input: CreateLinkRequest | UpdateLinkRequest,
  id?: string,
  signal?: AbortSignal,
  options?: { retryUnauthorized?: boolean; expectedStatus?: 201 },
) {
  const response = await authenticatedRequest(
    client,
    userId,
    id ? `/links/${encodeURIComponent(id)}` : '/links',
    {
      method: id ? 'PATCH' : 'POST',
      body: input,
      signal,
      retryUnauthorized: options?.retryUnauthorized,
    },
  );
  if (
    response.ok &&
    options?.expectedStatus &&
    response.status !== options.expectedStatus
  )
    throw new ApiRequestError('invalid');
  return checked(response, isLinkResponse);
}
export async function removeLink(
  client: SupabaseClient,
  userId: string,
  id: string,
  signal?: AbortSignal,
) {
  const r = await authenticatedRequest(
    client,
    userId,
    `/links/${encodeURIComponent(id)}`,
    { method: 'DELETE', signal },
  );
  if (!r.ok) throw new LinkApiError(r.status);
  if (r.status !== 204) throw new ApiRequestError('invalid');
}
export async function openLink(
  client: SupabaseClient,
  userId: string,
  id: string,
  signal?: AbortSignal,
  retryUnauthorized = true,
) {
  const result = await checked(
    await authenticatedRequest(
      client,
      userId,
      `/links/${encodeURIComponent(id)}/open`,
      { method: 'POST', signal, retryUnauthorized },
    ),
    isOpenLinkResponse,
  );
  if (!safeExternalUrl(result.url)) throw new ApiRequestError('invalid');
  return result;
}
