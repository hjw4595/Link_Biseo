import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isOrganizationReport,
  normalizeOrganizationTimeZone,
  type OrganizationReportRequest,
} from '@/contracts/organization-report';
import { authenticatedRequest, ApiRequestError } from './client';

export async function runOrganizationReport(
  client: SupabaseClient,
  userId: string,
  input: OrganizationReportRequest,
  signal: AbortSignal,
) {
  const timeZone = normalizeOrganizationTimeZone(
    input.timeZone ?? 'Asia/Seoul',
  );
  if (!timeZone) throw new ApiRequestError('invalid');
  const response = await authenticatedRequest(
    client,
    userId,
    '/organization-reports',
    { method: 'POST', body: { timeZone }, signal },
  );
  if (!response.ok) throw new ApiRequestError('invalid', response.status);
  if (response.status !== 200) throw new ApiRequestError('invalid');
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ApiRequestError('invalid');
  }
  if (
    !isOrganizationReport(value) ||
    normalizeOrganizationTimeZone(value.timeZone) !== timeZone
  )
    throw new ApiRequestError('invalid');
  if (signal.aborted) throw new ApiRequestError('aborted');
  return value;
}
export function organizationErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.kind === 'unauthorized') return '로그인 상태를 확인해 주세요.';
    if (error.kind === 'forbidden') return '이 보고서를 확인할 권한이 없어요.';
    if (error.kind === 'timeout')
      return '응답을 기다리는 시간이 길어졌어요. 다시 시도해 주세요.';
    if (error.kind === 'network') return '연결을 확인하고 다시 시도해 주세요.';
    if (error.status === 400)
      return '분석 요청을 확인할 수 없어요. 다시 시도해 주세요.';
    if (error.kind === 'invalid')
      return '보고서 응답을 확인할 수 없어요. 다시 시도해 주세요.';
    if (error.kind === 'configuration')
      return '보고서 연결 설정을 확인해 주세요.';
  }
  return '추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
}
