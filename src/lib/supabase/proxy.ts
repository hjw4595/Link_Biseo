import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authCookieOptions, getSupabaseConfig } from './config';
import { isProtectedPath, safeNext } from '@/features/auth/redirect';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const protectedPath = isProtectedPath(request.nextUrl.pathname);
  function finish(target?: URL) {
    const result = target ? NextResponse.redirect(target) : response;
    if (target)
      response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    result.headers.set('Cache-Control', 'private, no-store');
    return result;
  }
  function login(error?: string) {
    const url = new URL('/login', request.url);
    url.searchParams.set(
      'next',
      safeNext(request.nextUrl.pathname + request.nextUrl.search),
    );
    if (error) url.searchParams.set('error', error);
    return finish(url);
  }
  try {
    const { url, key } = getSupabaseConfig();
    const supabase = createServerClient(url, key, {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          const previous = response.cookies.getAll();
          response = NextResponse.next({ request });
          previous.forEach((cookie) => response.cookies.set(cookie));
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    // Auth server verification, never a cookie-only getSession authorization check.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (protectedPath && (!user || error))
      return login(
        error && error.name !== 'AuthSessionMissingError'
          ? 'session'
          : undefined,
      );
    if (user && !error && request.nextUrl.pathname === '/login')
      return finish(new URL('/', request.url));
    return finish();
  } catch {
    return protectedPath ? login('configuration') : finish();
  }
}
