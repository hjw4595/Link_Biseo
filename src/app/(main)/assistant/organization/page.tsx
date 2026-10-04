import { OrganizationReport } from '@/features/organization/components/organization-report';
import { CleanupPreview } from '@/features/organization/components/cleanup-preview';

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Legacy Cleanup regression preview uses the normal MainLayout auth guard.
  if (process.env.NODE_ENV === 'development' && params.preview === 'cleanup')
    return <CleanupPreview />;
  return <OrganizationReport />;
}
