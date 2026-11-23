import { readJsonResponse } from './response';
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
  const value = await readJsonResponse(response, isOrganizationReport, 200);
  if (normalizeOrganizationTimeZone(value.timeZone) !== timeZone)
    throw new ApiRequestError('invalid');
  if (signal.aborted) throw new ApiRequestError('aborted');
  return value;
}
