import { readJsonResponse, expectEmptyResponse } from './response';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isCategoryResponse,
  type CategoryResponse,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from '@/contracts';
import { authenticatedRequest, ApiRequestError } from './client';
import {
  isCategorySummaryResponse,
  type CategorySummaryResponse,
} from '@/contracts/categories';

function isCategoryList(value: unknown): value is CategoryResponse[] {
  return Array.isArray(value) && value.every(isCategoryResponse);
}

export async function listCategories(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
): Promise<CategoryResponse[]> {
  return readJsonResponse(
    await authenticatedRequest(client, userId, '/categories', { signal }),
    isCategoryList,
  );
}

export async function categorySummary(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
): Promise<CategorySummaryResponse> {
  return readJsonResponse(
    await authenticatedRequest(client, userId, '/categories/summary', {
      signal,
    }),
    isCategorySummaryResponse,
  );
}

export async function reorderCategories(
  client: SupabaseClient,
  userId: string,
  categoryIds: string[],
  signal?: AbortSignal,
): Promise<CategoryResponse[]> {
  const body = await readJsonResponse(
    await authenticatedRequest(client, userId, '/categories/reorder', {
      method: 'PATCH',
      body: { categoryIds },
      signal,
    }),
    isCategoryList,
  );
  if (
    body.length !== categoryIds.length ||
    new Set(body.map((row) => row.id)).size !== categoryIds.length ||
    body.some(
      (row, index) => row.id !== categoryIds[index] || row.sortOrder !== index,
    )
  )
    throw new ApiRequestError('invalid');
  return body;
}
export async function saveCategory(
  client: SupabaseClient,
  userId: string,
  input: CreateCategoryRequest | UpdateCategoryRequest,
  id?: string,
  signal?: AbortSignal,
  policy?: { retryUnauthorized: false; expectedStatus: 201 },
): Promise<CategoryResponse> {
  const response = await authenticatedRequest(
    client,
    userId,
    id ? `/categories/${encodeURIComponent(id)}` : '/categories',
    {
      method: id ? 'PATCH' : 'POST',
      body: input,
      signal,
      retryUnauthorized: policy?.retryUnauthorized,
    },
  );
  return readJsonResponse(response, isCategoryResponse, policy?.expectedStatus);
}
export async function deleteCategory(
  client: SupabaseClient,
  userId: string,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await authenticatedRequest(
    client,
    userId,
    `/categories/${encodeURIComponent(id)}`,
    { method: 'DELETE', signal },
  );
  expectEmptyResponse(response);
}
