import { Skeleton } from '@/components/ui/skeleton';
import { LinkListSkeleton } from '@/features/links/components/link-skeleton';

export function PageLoading({ text }: { text: string }) {
  return (
    <div className="screen-content">
      <Skeleton className="h-6 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-24" />
      </div>
      <LinkListSkeleton text={text} />
    </div>
  );
}
