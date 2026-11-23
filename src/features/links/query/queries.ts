'use client';
import { categoryQueryKeys } from '@/features/categories/query/keys';
import { linkQueryKeys } from './keys';
import { presetQueryKeys } from '@/features/quick-launch/query/keys';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { useRequestScope } from '@/lib/query/provider';
import { ApiRequestError } from '@/lib/api/client';
import { markOrganizationReportsStale } from '@/features/organization/query/cache';
import {
  getLink,
  previewLink,
  getLinkStats,
  listLinks,
  saveLink,
  removeLink,
  openLink,
} from '@/lib/api/links';
import type {
  CreateLinkRequest,
  UpdateLinkRequest,
  LinkFilters,
} from '@/contracts/links';
import { markLinkSummariesStale, refreshOpenedLink } from './cache';
export function useLinks(filters: LinkFilters = {}) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: linkQueryKeys.list(user.id, filters),
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
    queryKey: linkQueryKeys.detail(user.id, id),
    queryFn: ({ signal }) => getLink(createClient(), user.id, id, signal),
  });
}
export function useLinkPreview(url: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: linkQueryKeys.linkPreview(user.id, url),
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
    queryKey: linkQueryKeys.dailyStats(user.id, id, day, timeZone),
    queryFn: ({ signal }) =>
      getLinkStats(createClient(), user.id, id, signal, timeZone),
    enabled: day !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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
      if (action.type === 'open') {
        refreshOpenedLink(cache, user.id, action.id);
        return;
      }
      if (action.type === 'delete' || !action.id)
        markLinkSummariesStale(
          cache,
          user.id,
          action.type === 'delete' ? action.id : undefined,
        );
      else markOrganizationReportsStale(cache, user.id);
      void Promise.all([
        cache.invalidateQueries({
          queryKey: presetQueryKeys.presets(user.id),
        }),
        cache.invalidateQueries({
          queryKey: categoryQueryKeys.categorySummary(user.id),
        }),
      ]);
      if (action.id) {
        if (action.type === 'delete') {
          await cache.cancelQueries({
            queryKey: linkQueryKeys.stats(user.id, action.id),
          });
          cache.removeQueries({
            queryKey: linkQueryKeys.stats(user.id, action.id),
          });
        } else
          await cache.invalidateQueries({
            queryKey: linkQueryKeys.stats(user.id, action.id),
          });
        if (action.type === 'delete') {
          await cache.cancelQueries({
            queryKey: linkQueryKeys.detail(user.id, action.id),
          });
          cache.removeQueries({
            queryKey: linkQueryKeys.detail(user.id, action.id),
          });
        } else if (action.type === 'save' && data && 'id' in data) {
          await cache.cancelQueries({
            queryKey: linkQueryKeys.detail(user.id, action.id),
          });
          cache.setQueryData(linkQueryKeys.detail(user.id, action.id), data);
        } else
          await cache.invalidateQueries({
            queryKey: linkQueryKeys.detail(user.id, action.id),
          });
      }
      await cache.invalidateQueries({ queryKey: linkQueryKeys.lists(user.id) });
      if (action.type === 'save' && 'newCategoryName' in action.input)
        await cache.invalidateQueries({
          queryKey: categoryQueryKeys.categories(user.id),
        });
      await cache.invalidateQueries({
        queryKey: linkQueryKeys.cleanup(user.id),
      });
      if (scope().aborted) throw new ApiRequestError('aborted');
    },
  });
}
