export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error('Supabase 공개 URL과 공개 키를 설정해 주세요.');
  const parsed = new URL(url);
  if (
    (parsed.protocol !== 'https:' &&
      !(
        parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(parsed.hostname)
      )) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/'
  ) {
    throw new Error('Supabase URL 설정을 확인해 주세요.');
  }
  if (key.startsWith('sb_secret_'))
    throw new Error('공개 인증 키만 사용할 수 있어요.');
  // Legacy anon JWT keys remain supported; reject privileged keys before use.
  if (!key.startsWith('sb_publishable_')) {
    try {
      const part = key.split('.')[1];
      if (!part) throw new Error();
      const payload: unknown = JSON.parse(
        atob(part.replace(/-/g, '+').replace(/_/g, '/')),
      );
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('role' in payload) ||
        payload.role !== 'anon'
      )
        throw new Error();
    } catch {
      throw new Error('유효한 Supabase 공개 키를 설정해 주세요.');
    }
  }
  return { url: parsed.origin, key };
}

export const authCookieOptions = {
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};
