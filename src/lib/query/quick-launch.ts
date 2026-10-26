'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { useRequestScope } from './provider';
import { queryKeys } from './keys';
import {
  listPresets,
  getPreset,
  savePreset,
  deletePreset,
  reorderPresets,
} from '@/lib/api/quick-launch';
import { ApiRequestError } from '@/lib/api/client';
import type { PresetInput } from '@/contracts/quick-launch';
export function usePresets(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.presetList(user.id),
    queryFn: ({ signal }) => listPresets(createClient(), user.id, signal),
    enabled,
  });
}
export const PRESET_DETAIL_STALE_TIME = 15000;
export function usePreset(id: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.preset(user.id, id),
    queryFn: ({ signal }) => getPreset(createClient(), user.id, id, signal),
    enabled,
    staleTime: PRESET_DETAIL_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}
type Action =
  | { type: 'save'; id?: string; input: PresetInput }
  | { type: 'delete'; id: string }
  | { type: 'reorder'; ids: string[] };
export function usePresetMutation() {
  const { user } = useAuth(),
    cache = useQueryClient(),
    scope = useRequestScope();
  return useMutation({
    mutationKey: ['preset-write'],
    retry: false,
    mutationFn: async (action: Action) => {
      const signal = scope(),
        client = createClient();
      const result =
        action.type === 'save'
          ? await savePreset(client, user.id, action.input, signal, action.id)
          : action.type === 'delete'
            ? await deletePreset(client, user.id, action.id, signal)
            : await reorderPresets(client, user.id, action.ids, signal);
      if (signal.aborted) throw new ApiRequestError('aborted');
      return result;
    },
    onSuccess: (result, action) => {
      if (scope().aborted) return;
      if (action.type === 'delete')
        cache.removeQueries({ queryKey: queryKeys.preset(user.id, action.id) });
      if (result && 'links' in result)
        cache.setQueryData(queryKeys.preset(user.id, result.id), result);
      if (action.type === 'reorder' && result && 'items' in result)
        cache.setQueryData(queryKeys.presetList(user.id), result);
      void cache.invalidateQueries({ queryKey: queryKeys.presetList(user.id) });
      if (action.type === 'save' && result && 'links' in result)
        void cache.invalidateQueries({
          queryKey: queryKeys.preset(user.id, result.id),
        });
    },
    onError: (_error, action) => {
      if (scope().aborted) return;
      void cache.invalidateQueries({ queryKey: queryKeys.presetList(user.id) });
      // A failed write can have an unknown server outcome, but cannot change
      // unrelated presets. Link/category writes retain their broader scope.
      if (action.type !== 'reorder' && action.id)
        void cache.invalidateQueries({
          queryKey: queryKeys.preset(user.id, action.id),
        });
    },
  });
}
