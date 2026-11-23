import { notFound } from 'next/navigation';
import { UiPreview } from '@/screens/dev/ui-preview';

export const dynamic = 'force-dynamic';
export default function UiPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <UiPreview />;
}
