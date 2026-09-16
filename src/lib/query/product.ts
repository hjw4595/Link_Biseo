'use client';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { createClient } from '@/lib/supabase/client';
import {
  listCategories,
  saveCategory,
  deleteCategory,
  categorySummary,
  reorderCategories,
} from '@/lib/api/categories';
import {
  getLink,
  previewLink,
  getLinkStats,
  listLinks,
  saveLink,
  removeLink,
  openLink,
} from '@/lib/api/links';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '@/contracts';
import type {
  CreateLinkRequest,
  UpdateLinkRequest,
  LinkFilters,
} from '@/contracts/links';
import { queryKeys } from './keys';
import { useRequestScope } from './provider';
import { ApiRequestError } from '@/lib/api/client';
import { markUsageSummaryStale } from './usage-summary';
import { markOrganizationReportsStale } from './organization';

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.categories(user.id),
    queryFn: ({ signal }) => listCategories(createClient(), user.id, signal),
  });
}
export function useCategorySummary(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.categorySummary(user.id),
    queryFn: ({ signal }) => categorySummary(createClient(), user.id, signal),
    enabled,
  });
}
export function useLinks(filters: LinkFilters = {}) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: queryKeys.list(user.id, filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listLinks(createClient(), user.id, filters, pageParam, signal),
    getNextPageParam: (last, _pages, previous, params) =>
      last.nextCursor &&
      last.nextCursor !== previous &&
      !params.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
  });
}
export function useLink(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.detail(user.id, id),
    queryFn: ({ signal }) => getLink(createClient(), user.id, id, signal),
  });
}
export function useLinkPreview(url: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.linkPreview(user.id, url),
    queryFn: ({ signal }) => {
      if (!url) throw new ApiRequestError('invalid');
      return previewLink(createClient(), user.id, url, signal);
    },
    enabled: url !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
export function useLinkStats(
  id: string,
  day: string | null,
  timeZone = 'Asia/Seoul',
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.dailyStats(user.id, id, day, timeZone),
    queryFn: ({ signal }) =>
      getLinkStats(createClient(), user.id, id, signal, timeZone),
    enabled: day !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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
      void cache.invalidateQueries({ queryKey: queryKeys.presets(user.id) });
      await Promise.all([
        cache.invalidateQueries({ queryKey: queryKeys.categories(user.id) }),
        ...('id' in action && action.id
          ? [cache.invalidateQueries({ queryKey: queryKeys.links(user.id) })]
          : []),
      ]);
      if (scope().aborted) throw new ApiRequestError('aborted');
    },
  });
}
type LinkAction =
  | { type: 'save'; input: CreateLinkRequest | UpdateLinkRequest; id?: string }
  | { type: 'delete'; id: string }
  | { type: 'open'; id: string; signal?: AbortSignal };
export function useLinkMutation() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const scope = useRequestScope();
  return useMutation({
    mutationFn: async (action: LinkAction) => {
      if (action.type === 'delete') {
        await removeLink(createClient(), user.id, action.id, scope());
        return undefined;
      }
      if (action.type === 'open')
        return openLink(
          createClient(),
          user.id,
          action.id,
          AbortSignal.any([scope(), ...(action.signal ? [action.signal] : [])]),
        );
      return saveLink(
        createClient(),
        user.id,
        action.input,
        action.id,
        scope(),
      );
    },
    onSuccess: async (data, action) => {
      if (scope().aborted) throw new ApiRequestError('aborted');
      if (action.type === 'open' && action.signal?.aborted)
        throw new ApiRequestError('aborted');
      if (
        action.type === 'open' ||
        action.type === 'delete' ||
        (action.type === 'save' && !action.id)
      )
        markUsageSummaryStale(cache, user.id);
      if (action.type !== 'open')
        void Promise.all([
          cache.invalidateQueries({ queryKey: queryKeys.presets(user.id) }),
          cache.invalidateQueries({
            queryKey: queryKeys.categorySummary(user.id),
          }),
        ]);
      markOrganizationReportsStale(
        cache,
        user.id,
        action.type === 'delete' ? action.id : undefined,
      );
      if (action.type === 'open') {
        // A committed Open must not wait for unrelated GETs before navigation.
        // Invalidation errors are query errors, never a reason to repeat a POST.
        void Promise.all([
          cache.invalidateQueries({
            queryKey: queryKeys.stats(user.id, action.id),
          }),
          cache.invalidateQueries({
            queryKey: queryKeys.detail(user.id, action.id),
          }),
          cache.invalidateQueries({ queryKey: queryKeys.lists(user.id) }),
          cache.invalidateQueries({ queryKey: queryKeys.cleanup(user.id) }),
        ]).catch(() => {});
        return;
      }
      if (action.id) {
        if (action.type === 'delete') {
          await cache.cancelQueries({
            queryKey: queryKeys.stats(user.id, action.id),
          });
          cache.removeQueries({
            queryKey: queryKeys.stats(user.id, action.id),
          });
        } else
          await cache.invalidateQueries({
            queryKey: queryKeys.stats(user.id, action.id),
          });
        if (action.type === 'delete') {
          await cache.cancelQueries({
            queryKey: queryKeys.detail(user.id, action.id),
          });
          cache.removeQueries({
            queryKey: queryKeys.detail(user.id, action.id),
          });
        } else if (action.type === 'save' && data && 'id' in data) {
          await cache.cancelQueries({
            queryKey: queryKeys.detail(user.id, action.id),
          });
          cache.setQueryData(queryKeys.detail(user.id, action.id), data);
        } else
          await cache.invalidateQueries({
            queryKey: queryKeys.detail(user.id, action.id),
          });
      }
      await cache.invalidateQueries({ queryKey: queryKeys.lists(user.id) });
      if (action.type === 'save' && 'newCategoryName' in action.input)
        await cache.invalidateQueries({
          queryKey: queryKeys.categories(user.id),
        });
      await cache.invalidateQueries({ queryKey: queryKeys.cleanup(user.id) });
      if (scope().aborted) throw new ApiRequestError('aborted');
    },
  });
}
