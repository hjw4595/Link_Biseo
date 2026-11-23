import { OrganizationScreen } from '@/screens/organization/organization-screen';
import { devPreviewsEnabled } from '@/screens/dev/access';

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Legacy Cleanup regression preview uses the normal MainLayout auth guard.
  if (devPreviewsEnabled() && params.preview === 'cleanup') {
    const { CleanupPreview } =
      await import('@/screens/dev/cleanup/cleanup-preview');
    return <CleanupPreview />;
  }
  return <OrganizationScreen />;
}
