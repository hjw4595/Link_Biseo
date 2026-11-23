import { notFound } from 'next/navigation';
import { devPreviewsEnabled } from '@/screens/dev/access';

export const dynamic = 'force-dynamic';
export default async function UiPreviewPage() {
  if (!devPreviewsEnabled()) notFound();
  const { UiPreview } = await import('@/screens/dev/ui-preview');
  return <UiPreview />;
}
