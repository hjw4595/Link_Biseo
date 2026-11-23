import { readJsonResponse, expectEmptyResponse } from './response';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticatedRequest, ApiRequestError } from './client';
import {
  isPresetDetail,
  isPresetList,
  type PresetInput,
} from '@/contracts/quick-launch';
const base = '/quick-launch-presets';
export async function listPresets(
  c: SupabaseClient,
  user: string,
  signal: AbortSignal,
) {
  return readJsonResponse(
    await authenticatedRequest(c, user, base, { signal }),
    isPresetList,
    200,
  );
}
export async function getPreset(
  c: SupabaseClient,
  user: string,
  id: string,
  signal: AbortSignal,
) {
  const result = await readJsonResponse(
    await authenticatedRequest(c, user, `${base}/${encodeURIComponent(id)}`, {
      signal,
    }),
    isPresetDetail,
    200,
  );
  if (result.id !== id) throw new ApiRequestError('invalid');
  return result;
}
export async function savePreset(
  c: SupabaseClient,
  user: string,
  input: PresetInput,
  signal: AbortSignal,
  id?: string,
) {
  const result = await readJsonResponse(
    await authenticatedRequest(
      c,
      user,
      id ? `${base}/${encodeURIComponent(id)}` : base,
      {
        method: id ? 'PATCH' : 'POST',
        body: input,
        signal,
        retryUnauthorized: false,
      },
    ),
    isPresetDetail,
    id ? 200 : 201,
  );
  if (id && result.id !== id) throw new ApiRequestError('invalid');
  return result;
}
export async function deletePreset(
  c: SupabaseClient,
  user: string,
  id: string,
  signal: AbortSignal,
) {
  const r = await authenticatedRequest(
    c,
    user,
    `${base}/${encodeURIComponent(id)}`,
    { method: 'DELETE', signal, retryUnauthorized: false },
  );
  expectEmptyResponse(r);
}
export async function reorderPresets(
  c: SupabaseClient,
  user: string,
  presetIds: string[],
  signal: AbortSignal,
) {
  return readJsonResponse(
    await authenticatedRequest(c, user, `${base}/reorder`, {
      method: 'PATCH',
      body: { presetIds },
      signal,
      retryUnauthorized: false,
    }),
    isPresetList,
    200,
  );
}
