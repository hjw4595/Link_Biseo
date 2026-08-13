import { Skeleton } from '@/components/ui/skeleton';
import { CategoryBentoSkeleton } from '@/features/categories/components/category-skeleton';
import { LinkListSkeleton } from '@/features/links/components/link-skeleton';
export default function Loading() {
  return (
    <div className="screen-content">
      <Skeleton className="h-6 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <CategoryBentoSkeleton text="카테고리를 불러오고 있어요." />
      <Skeleton className="h-5 w-24" />
      <LinkListSkeleton count={3} text="링크를 불러오고 있어요." />
    </div>
  );
}
