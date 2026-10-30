import { notFound } from 'next/navigation';
import { isUuid } from '@/contracts/links';
import { LinkDetail } from '@/features/links/components/link-detail';

export default async function LinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <LinkDetail id={id} />;
}
