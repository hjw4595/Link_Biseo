// One external-navigation policy for saved URLs and Open API responses.
export function safeExternalUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
