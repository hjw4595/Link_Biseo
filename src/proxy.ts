import type { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/proxy';

export function proxy(request: NextRequest) {
  return updateSession(request);
}
export const config = {
  matcher: [
    '/',
    '/login',
    '/categories/:path*',
    '/category/:path*',
    '/links/:path*',
    '/settings/:path*',
    '/assistant/organization',
  ],
};
