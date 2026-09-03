// Isolated GoTrue-shaped test service. Never imported by application code.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'tester@example.test',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: '테스트 사용자' },
  created_at: '2026-01-01T00:00:00Z',
};
const codes = new Set<string>();
function identityFor(kind: string) {
  const identity =
    kind === 'alternate' || kind === 'email-alternate'
      ? {
          ...user,
          id: '22222222-2222-4222-8222-222222222222',
          email: 'second@example.test',
        }
      : user;
  return kind.startsWith('email')
    ? { ...identity, app_metadata: { provider: 'email' }, user_metadata: {} }
    : identity;
}
function session(kind = 'valid') {
  const currentUser = identityFor(kind);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64url',
      ),
      Buffer.from(
        JSON.stringify({
          sub: currentUser.id,
          exp,
          kind,
          nonce: randomUUID(),
        }),
      ).toString('base64url'),
      'test-signature',
    ].join('.'),
    refresh_token: kind.startsWith('email')
      ? `test-refresh-${kind}`
      : 'test-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: currentUser,
  };
}
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3100');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS',
  );
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  const url = new URL(req.url || '/', 'http://127.0.0.1:54329');
  // Real loopback HTTP destination for native modifier/middle-click tests.
  // Chromium can fail to expose background tabs whose initial request is routed.
  // This endpoint remains a test fixture, never a backend/application write.
  if (url.pathname === '/external' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<h1>Mock external destination</h1><div id="authorization">${Boolean(req.headers.authorization)}</div><div id="referrer">${Boolean(req.headers.referer)}</div>`,
    );
    return;
  }
  function json(status: number, body: unknown) {
    res.writeHead(status);
    res.end(JSON.stringify(body));
  }
  function unauthorized() {
    json(401, { code: 'bad_jwt', message: 'Invalid test session' });
  }
  if (url.pathname === '/categories' && req.method === 'GET') {
    json(200, []);
    return;
  }
  if (url.pathname === '/auth/v1/authorize') {
    const destination = url.searchParams.get('redirect_to');
    if (
      !destination ||
      !url.searchParams.has('code_challenge') ||
      !destination.startsWith('http://localhost:3100/auth/callback')
    ) {
      unauthorized();
      return;
    }
    const code = randomUUID();
    codes.add(code);
    const callback = new URL(destination);
    callback.searchParams.set('code', code);
    res.writeHead(302, { Location: callback.href });
    res.end();
    return;
  }
  if (url.pathname === '/auth/v1/token') {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      let data: unknown;
      try {
        data = JSON.parse(body);
      } catch {
        unauthorized();
        return;
      }
      if (typeof data !== 'object' || data === null) {
        unauthorized();
        return;
      }
      if (url.searchParams.get('grant_type') === 'pkce') {
        if (
          !('auth_code' in data) ||
          typeof data.auth_code !== 'string' ||
          !codes.delete(data.auth_code) ||
          !('code_verifier' in data) ||
          !data.code_verifier
        ) {
          unauthorized();
          return;
        }
      } else if (
        !('refresh_token' in data) ||
        ![
          'test-refresh',
          'test-refresh-email',
          'test-refresh-email-alternate',
        ].includes(String(data.refresh_token))
      ) {
        unauthorized();
        return;
      }
      const kind =
        'refresh_token' in data &&
        typeof data.refresh_token === 'string' &&
        data.refresh_token.startsWith('test-refresh-email')
          ? data.refresh_token.slice('test-refresh-'.length)
          : 'valid';
      json(200, session(kind));
    });
    return;
  }
  if (
    url.pathname === '/auth/v1/user' ||
    url.pathname === '/auth/me' ||
    url.pathname === '/auth/v1/logout'
  ) {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    let claims: unknown;
    try {
      const part = token?.split('.')[1];
      if (!part || !token?.endsWith('.test-signature')) throw new Error();
      claims = JSON.parse(Buffer.from(part, 'base64url').toString());
    } catch {
      unauthorized();
      return;
    }
    if (
      typeof claims !== 'object' ||
      claims === null ||
      !('exp' in claims) ||
      typeof claims.exp !== 'number' ||
      claims.exp <= Date.now() / 1000 ||
      ('kind' in claims && claims.kind === 'invalid')
    ) {
      unauthorized();
      return;
    }
    if (url.pathname === '/auth/v1/logout') {
      res.writeHead(204);
      res.end();
      return;
    }
    const currentUser = identityFor(
      'kind' in claims && typeof claims.kind === 'string'
        ? claims.kind
        : 'valid',
    );
    json(
      200,
      url.pathname === '/auth/me'
        ? { id: currentUser.id, email: currentUser.email }
        : currentUser,
    );
    return;
  }
  json(200, { status: 'ok' });
}).listen(54329, '127.0.0.1');
