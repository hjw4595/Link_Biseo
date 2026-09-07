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

export class CategoryApiError extends Error {
  constructor(public readonly kind: 'conflict' | 'not-found' | 'validation') {
    super(kind);
  }
}

export function categoryErrorMessage(error: unknown): string {
  if (error instanceof CategoryApiError)
    return {
      conflict: '같은 이름의 카테고리가 있어요. 다른 이름을 입력해 주세요.',
      'not-found': '카테고리를 찾을 수 없어요. 목록을 새로 불러와 주세요.',
      validation: '입력한 내용을 확인해 주세요.',
    }[error.kind];
  if (error instanceof ApiRequestError)
    return {
      unauthorized: '로그인 상태를 확인할 수 없어요. 다시 로그인해 주세요.',
      forbidden: '카테고리에 접근할 권한이 없어요.',
      network: '연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.',
      server: '잠시 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
      invalid: '카테고리 응답을 확인할 수 없어요.',
      timeout: '응답 시간이 초과됐어요. 다시 시도해 주세요.',
      aborted: '요청이 취소됐어요.',
      configuration: '서비스 연결 설정을 확인해 주세요.',
    }[error.kind];
  return '처리하지 못했어요. 다시 시도해 주세요.';
}

async function checked(response: Response): Promise<unknown> {
  if (response.status === 409) throw new CategoryApiError('conflict');
  if (response.status === 404) throw new CategoryApiError('not-found');
  if (response.status === 400) throw new CategoryApiError('validation');
  if (!response.ok) throw new ApiRequestError('invalid');
  if (response.status === 204) return undefined;
  try {
    return await response.json();
  } catch {
    throw new ApiRequestError('invalid');
  }
}

export async function listCategories(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
): Promise<CategoryResponse[]> {
  const body = await checked(
    await authenticatedRequest(client, userId, '/categories', { signal }),
  );
  if (!Array.isArray(body) || !body.every(isCategoryResponse))
    throw new ApiRequestError('invalid');
  return body;
}

export async function categorySummary(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
): Promise<CategorySummaryResponse> {
  const body = await checked(
    await authenticatedRequest(client, userId, '/categories/summary', {
      signal,
    }),
  );
  if (!isCategorySummaryResponse(body)) throw new ApiRequestError('invalid');
  return body;
}

export async function reorderCategories(
  client: SupabaseClient,
  userId: string,
  categoryIds: string[],
  signal?: AbortSignal,
): Promise<CategoryResponse[]> {
  const body = await checked(
    await authenticatedRequest(client, userId, '/categories/reorder', {
      method: 'PATCH',
      body: { categoryIds },
      signal,
    }),
  );
  if (
    !Array.isArray(body) ||
    !body.every(isCategoryResponse) ||
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
  const body = await checked(response);
  if (policy && response.status !== policy.expectedStatus)
    throw new ApiRequestError('invalid');
  if (!isCategoryResponse(body)) throw new ApiRequestError('invalid');
  return body;
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
  await checked(response);
  if (response.status !== 204) throw new ApiRequestError('invalid');
}
