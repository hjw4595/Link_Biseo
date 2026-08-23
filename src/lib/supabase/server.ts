import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { authCookieOptions, getSupabaseConfig } from './config';

export async function createClient() {
  const store = await cookies();
  const { url, key } = getSupabaseConfig();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components cannot write; Proxy refreshes cookies first. */
        }
      },
    },
  });
}
