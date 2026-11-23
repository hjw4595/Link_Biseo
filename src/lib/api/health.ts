import { isHealthResponse, type HealthResponse } from '@/contracts';
import { ApiRequestError } from './client';
import { readJsonResponse } from './response';

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const requestSignal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(5000),
  ]);
  let response: Response;
  try {
    response = await fetch(baseUrl.replace(/\/$/, '') + '/health', {
      cache: 'no-store',
      signal: requestSignal,
    });
  } catch {
    throw new ApiRequestError(
      signal?.aborted
        ? 'aborted'
        : requestSignal.aborted
          ? 'timeout'
          : 'network',
    );
  }
  return readJsonResponse(response, isHealthResponse);
}
