// Match the backend's string-only normalization. SSRF/DNS checks stay in Nest.
export function createLinkUrl(input: string): URL | null {
  try {
    if (
      input.length > 2048 ||
      [...input].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
      input.includes('\\')
    )
      return null;
    encodeURIComponent(input);
    const raw = input.trim();
    if (
      !/^https?:\/\//i.test(raw) ||
      raw.split('://')[1]?.split(/[/?#]/)[0]?.includes('@')
    )
      return null;
    const url = new URL(raw);
    const host = url.hostname;
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !host ||
      host.length > 255
    )
      return null;
    // URL already validates IPv6; DNS names use the backend's label policy.
    if (
      !host.startsWith('[') &&
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*\.?$/i.test(
        host,
      )
    )
      return null;
    url.hash = '';
    return url.href.length <= 2048 ? url : null;
  } catch {
    return null;
  }
}
