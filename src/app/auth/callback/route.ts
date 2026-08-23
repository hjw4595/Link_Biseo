import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/features/auth/redirect';

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const failure = new URL('/login', request.url);
  failure.searchParams.set('error', 'oauth');
  failure.searchParams.set('next', next);
  let destination = failure;
  const code = request.nextUrl.searchParams.get('code');
  if (code && !request.nextUrl.searchParams.has('error')) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data, error: userError } = await supabase.auth.getUser();
        if (data.user && !userError) destination = new URL(next, request.url);
      }
    } catch {
      /* Do not log OAuth codes, provider errors, or tokens. */
    }
  }
  const response = NextResponse.redirect(destination);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
