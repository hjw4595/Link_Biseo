'use client';
import { categoryQueryKeys } from './keys';
import { linkQueryKeys } from '@/features/links/query/keys';
import { presetQueryKeys } from '@/features/quick-launch/query/keys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { useRequestScope } from '@/lib/query/provider';
import { ApiRequestError } from '@/lib/api/client';
import { markOrganizationReportsStale } from '@/features/organization/query/cache';
import {
  listCategories,
  saveCategory,
  deleteCategory,
  categorySummary,
  reorderCategories,
} from '@/lib/api/categories';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '@/contracts';
export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: categoryQueryKeys.categories(user.id),
    queryFn: ({ signal }) => listCategories(createClient(), user.id, signal),
  });
}
export function useCategorySummary(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: categoryQueryKeys.categorySummary(user.id),
    queryFn: ({ signal }) => categorySummary(createClient(), user.id, signal),
    enabled,
  });
}
type CategoryAction =
  | {
      type: 'save';
      input: CreateCategoryRequest | UpdateCategoryRequest;
      id?: string;
    }
  | { type: 'delete'; id: string }
  | { type: 'reorder'; categoryIds: string[] };
export function useCategoryMutation() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const scope = useRequestScope();
  return useMutation({
    mutationFn: async (action: CategoryAction) =>
      action.type === 'delete'
        ? deleteCategory(createClient(), user.id, action.id, scope())
        : action.type === 'reorder'
          ? reorderCategories(
              createClient(),
              user.id,
              action.categoryIds,
              scope(),
            )
          : saveCategory(
              createClient(),
              user.id,
              action.input,
              action.id,
              scope(),
            ),
    onSuccess: async (_data, action) => {
      if (scope().aborted) throw new ApiRequestError('aborted');
      markOrganizationReportsStale(cache, user.id);
      void cache.invalidateQueries({
        queryKey: presetQueryKeys.presets(user.id),
      });
      await Promise.all([
        cache.invalidateQueries({
          queryKey: categoryQueryKeys.categories(user.id),
        }),
        ...('id' in action && action.id
          ? [
              cache.invalidateQueries({
                queryKey: linkQueryKeys.links(user.id),
              }),
            ]
          : []),
      ]);
      if (scope().aborted) throw new ApiRequestError('aborted');
    },
  });
}
