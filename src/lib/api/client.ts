import type { SupabaseClient } from '@supabase/supabase-js';

export type ApiRequestErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'network'
  | 'server'
  | 'invalid'
  | 'configuration'
  | 'timeout'
  | 'aborted';
export class ApiRequestError extends Error {
  constructor(
    public readonly kind: ApiRequestErrorKind,
    public readonly status?: number,
  ) {
    super(kind);
  }
}

// One session/refresh policy for Auth and product APIs. Never retry a failed write
// after a network error; a 401 is retried only after the Guard rejected it.
export async function authenticatedRequest(
  client: SupabaseClient,
  expectedUserId: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
    query?: Record<string, string | number | boolean | undefined>;
    timeoutMs?: number;
    retryUnauthorized?: boolean;
  } = {},
): Promise<Response> {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (!configured) throw new ApiRequestError('configuration');
  let base: URL;
  try {
    base = new URL(configured);
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      throw new Error();
  } catch {
    throw new ApiRequestError('configuration');
  }
  const url = new URL(base.href.replace(/\/$/, '') + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const signal = AbortSignal.any([
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(options.timeoutMs ?? 10000),
  ]);
  const checkAbort = () => {
    if (signal.aborted)
      throw new ApiRequestError(
        options.signal?.aborted ? 'aborted' : 'timeout',
      );
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    checkAbort();
    const { data, error } =
      attempt === 0
        ? await client.auth.getSession()
        : await client.auth.refreshSession();
    if (error || !data.session || data.session.user.id !== expectedUserId) {
      throw new ApiRequestError(
        error && (!error.status || error.status >= 500)
          ? 'network'
          : 'unauthorized',
      );
    }
    checkAbort();
    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
        cache: 'no-store',
        redirect: 'error',
        credentials: 'omit',
        signal,
      });
    } catch {
      checkAbort();
      throw new ApiRequestError('network');
    }
    checkAbort();
    const current = await client.auth.getSession();
    checkAbort();
    if (current.error || current.data.session?.user.id !== expectedUserId)
      throw new ApiRequestError('unauthorized');
    if (
      response.status === 401 &&
      attempt === 0 &&
      options.retryUnauthorized !== false
    )
      continue;
    if (response.status === 401) throw new ApiRequestError('unauthorized', 401);
    if (response.status === 403) throw new ApiRequestError('forbidden', 403);
    if (response.status >= 500)
      throw new ApiRequestError('server', response.status);
    return response;
  }
  throw new ApiRequestError('unauthorized');
}
