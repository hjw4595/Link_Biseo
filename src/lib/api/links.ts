import { readJsonResponse, expectEmptyResponse } from './response';
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

export async function listLinks(
  client: SupabaseClient,
  userId: string,
  filters: LinkFilters,
  cursor?: string,
  signal?: AbortSignal,
) {
  return readJsonResponse(
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
  const result = await readJsonResponse(
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
  return readJsonResponse(
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
  const result = await readJsonResponse(
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
  return readJsonResponse(response, isLinkResponse, options?.expectedStatus);
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
  expectEmptyResponse(r);
}
export async function openLink(
  client: SupabaseClient,
  userId: string,
  id: string,
  signal?: AbortSignal,
  retryUnauthorized = true,
) {
  const result = await readJsonResponse(
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
