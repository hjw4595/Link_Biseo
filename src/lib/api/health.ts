import { isHealthResponse, type HealthResponse } from '@/contracts';

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const response = await fetch(baseUrl.replace(/\/$/, '') + '/health', {
    cache: 'no-store',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
      : AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Health request failed');
  const data: unknown = await response.json();
  if (!isHealthResponse(data)) throw new Error('Invalid health response');
  return data;
}
