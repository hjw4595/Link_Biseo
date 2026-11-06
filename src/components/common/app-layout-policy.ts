export type LayoutProfile = 'compact' | 'home' | 'hub' | 'workspace';

// Every page (including auth/loading/errors) shares one responsive frame.
// Route profiles remain semantic labels; Sheets and dialogs own their sizing.
const pageWidth = 'max-w-lg md:max-w-3xl lg:max-w-6xl';
export const profileClasses: Record<LayoutProfile, string> = {
  compact: pageWidth,
  home: pageWidth,
  hub: pageWidth,
  workspace: pageWidth,
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
