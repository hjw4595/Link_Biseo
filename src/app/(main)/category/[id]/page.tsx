import { notFound } from 'next/navigation';
import { isUuid } from '@/contracts/links';
import { CategoryScreen } from '@/features/categories/components/category-screen';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <CategoryScreen id={id} />;
}
