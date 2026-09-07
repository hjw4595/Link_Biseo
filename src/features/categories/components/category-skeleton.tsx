import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonStatus } from '@/components/common/skeleton-status';

export function CategoryBentoSkeleton({ text }: { text: string }) {
  return (
    <SkeletonStatus text={text}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Skeleton className="row-span-2 h-46 rounded-lg lg:row-span-1 lg:h-24" />
        <Skeleton className="h-21.5 rounded-lg lg:h-24" />
        <Skeleton className="h-21.5 rounded-lg lg:h-24" />
        <Skeleton className="h-20 rounded-lg lg:h-24" />
        <Skeleton className="h-20 rounded-lg lg:h-24" />
      </div>
    </SkeletonStatus>
  );
}

export function CategoryListSkeleton({ text }: { text: string }) {
  return (
    <SkeletonStatus text={text}>
      <div className="space-y-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-16 w-full" />
        ))}
      </div>
    </SkeletonStatus>
  );
}
