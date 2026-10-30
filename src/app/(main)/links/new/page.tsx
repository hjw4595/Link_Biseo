import { AddLinkForm } from '@/features/links/components/add-link-form';
export default async function NewLinkPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoryId?: string | string[];
    from?: string | string[];
  }>;
}) {
  const { categoryId, from } = await searchParams;
  const initialCategoryId = typeof categoryId === 'string' ? categoryId : '';
  return (
    <AddLinkForm
      key={JSON.stringify([initialCategoryId, from === 'links'])}
      initialCategoryId={initialCategoryId}
      returnToLinks={from === 'links'}
    />
  );
}
