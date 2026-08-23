export function isProtectedPath(path: string): boolean {
  return (
    path === '/' ||
    path === '/assistant/organization' ||
    /^\/(categories|category|links|settings)(\/|$)/.test(path)
  );
}

export function safeNext(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    hasUnsafeCharacter(value) ||
    /%25|%2f|%5c/i.test(value)
  )
    return '/';
  try {
    const decoded = decodeURIComponent(value);
    if (hasUnsafeCharacter(decoded) || decoded.startsWith('//')) return '/';
    const url = new URL(value, 'https://internal.invalid');
    if (
      url.origin !== 'https://internal.invalid' ||
      !isProtectedPath(url.pathname)
    )
      return '/';
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}

function hasUnsafeCharacter(value: string): boolean {
  return (
    /[\\\s]/.test(value) ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}
