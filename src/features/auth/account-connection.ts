import type { User } from '@supabase/supabase-js';
// Display only: connected providers are not evidence of the last login method.
export function accountConnection(user: User): string | null {
  const identities = user.identities;
  const raw: unknown = user.app_metadata.providers;
  const providers = identities?.length
    ? identities.map((identity) => identity.provider)
    : Array.isArray(raw) && raw.length
      ? raw
      : [user.app_metadata.provider];
  if (
    providers.some(
      (provider) => typeof provider !== 'string' || !provider.trim(),
    )
  )
    return null;
  if (providers.length > 1) return '복수 연결';
  return providers[0] === 'google'
    ? 'Google'
    : providers[0] === 'email'
      ? '이메일'
      : null;
}
