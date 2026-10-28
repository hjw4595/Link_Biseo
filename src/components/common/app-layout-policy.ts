export type LayoutProfile = 'compact' | 'home' | 'hub' | 'workspace';

// All navigation tabs share one outer width, including page padding.
const navigationWidth = 'max-w-lg md:max-w-3xl lg:max-w-6xl';
export const profileClasses: Record<LayoutProfile, string> = {
  compact: 'max-w-lg',
  home: navigationWidth,
  hub: navigationWidth,
  workspace: navigationWidth,
};

export function layoutProfile(pathname: string): LayoutProfile {
  if (pathname === '/') return 'home';
  if (
    ['/settings', '/categories', '/assistant/organization'].includes(pathname)
  )
    return 'hub';
  // Static /links routes must precede the detail fallback.
  if (pathname === '/links/new') return 'compact';
  if (
    pathname === '/links' ||
    pathname === '/links/import' ||
    /^\/category\/[^/]+$/.test(pathname)
  )
    return 'workspace';
  return 'compact';
}
