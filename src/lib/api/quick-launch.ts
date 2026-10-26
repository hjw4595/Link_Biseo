import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticatedRequest, ApiRequestError } from './client';
import {
  isPresetDetail,
  isPresetList,
  type PresetInput,
} from '@/contracts/quick-launch';
export class PresetApiError extends Error {
  constructor(public readonly status: number) {
    super('Preset request failed');
  }
}
export function presetErrorMessage(error: unknown, list = false) {
  if (error instanceof PresetApiError) {
    if (error.status === 404 && list)
      return '빠른 실행 API가 아직 제공되지 않아요.';
    if (error.status === 404 || error.status === 409)
      return '빠른 실행 또는 링크가 변경됐어요. 목록을 다시 확인해 주세요.';
    if (error.status === 400)
      return '이름과 선택한 링크를 확인해 주세요. 빠른 실행은 최대 50개, 새로 포함할 링크는 최대 8개예요.';
    if (error.status === 429)
      return '요청이 많아요. 잠시 후 목록을 다시 확인해 주세요.';
  }
  if (error instanceof ApiRequestError) {
    if (error.kind === 'unauthorized')
      return '로그인 상태를 다시 확인해 주세요.';
    if (error.kind === 'forbidden') return '이 빠른 실행에 접근할 수 없어요.';
    if (error.kind === 'invalid')
      return '빠른 실행 API 응답을 확인할 수 없어요.';
    if (error.status === 501) return '빠른 실행 API가 아직 제공되지 않아요.';
  }
  return '빠른 실행 서버에 연결하지 못했어요. 저장 요청 후라면 목록을 다시 확인해 주세요.';
}
async function checked<T>(
  r: Response,
  status: number,
  validate: (v: unknown) => v is T,
): Promise<T> {
  if (!r.ok) throw new PresetApiError(r.status);
  if (r.status !== status) throw new ApiRequestError('invalid');
  let v: unknown;
  try {
    v = await r.json();
  } catch {
    throw new ApiRequestError('invalid');
  }
  if (!validate(v)) throw new ApiRequestError('invalid');
  return v;
}
const base = '/quick-launch-presets';
export async function listPresets(
  c: SupabaseClient,
  user: string,
  signal: AbortSignal,
) {
  return checked(
    await authenticatedRequest(c, user, base, { signal }),
    200,
    isPresetList,
  );
}
export async function getPreset(
  c: SupabaseClient,
  user: string,
  id: string,
  signal: AbortSignal,
) {
  const result = await checked(
    await authenticatedRequest(c, user, `${base}/${encodeURIComponent(id)}`, {
      signal,
    }),
    200,
    isPresetDetail,
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
  const result = await checked(
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
    id ? 200 : 201,
    isPresetDetail,
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
  if (!r.ok) throw new PresetApiError(r.status);
  if (r.status !== 204) throw new ApiRequestError('invalid');
}
export async function reorderPresets(
  c: SupabaseClient,
  user: string,
  presetIds: string[],
  signal: AbortSignal,
) {
  return checked(
    await authenticatedRequest(c, user, `${base}/reorder`, {
      method: 'PATCH',
      body: { presetIds },
      signal,
      retryUnauthorized: false,
    }),
    200,
    isPresetList,
  );
}
