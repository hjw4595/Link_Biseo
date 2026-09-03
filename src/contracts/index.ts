export type HealthResponse = { status: 'ok' };
export * from './categories';

// Matches the separately maintained biseo_BE GET /auth/me contract.
export type AuthMeResponse = { id: string; email?: string };
export function isAuthMeResponse(value: unknown): value is AuthMeResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.id,
    ) &&
    (!('email' in value) || typeof value.email === 'string')
  );
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === 'ok'
  );
}
