type OriginConfig = {
  production: boolean;
  appOrigin?: string;
};

// request.url may contain the Next.js container hostname behind Cloud Run.
// Forwarded headers select a host, but never grant trust to an arbitrary host.
export function getAuthRequestOrigin(
  request: Pick<Request, 'url' | 'headers'>,
  config: OriginConfig = {
    production: process.env.NODE_ENV === 'production',
    appOrigin: process.env.APP_ORIGIN,
  },
): string | null {
  try {
    const host =
      request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    if (!host || /[\s,\\/@?#]/.test(host)) return null;
    const allowed = new URL(
      config.production
        ? config.appOrigin || ''
        : `${new URL(request.url).protocol}//${host}`,
    );
    if (config.production) {
      if (
        allowed.protocol !== 'https:' ||
        allowed.username ||
        allowed.password ||
        allowed.pathname !== '/' ||
        allowed.search ||
        allowed.hash ||
        isLoopback(allowed.hostname)
      )
        return null;
    } else if (
      !isLoopback(allowed.hostname) ||
      !['http:', 'https:'].includes(allowed.protocol)
    ) {
      return null;
    }

    const proto = request.headers.get('x-forwarded-proto');
    // Reject lists, credentials, paths, ports that differ, and malformed hosts.
    if (
      host.toLowerCase() !== allowed.host ||
      (proto !== null && proto !== allowed.protocol.slice(0, -1))
    )
      return null;
    return allowed.origin;
  } catch {
    return null;
  }
}

function isLoopback(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}
