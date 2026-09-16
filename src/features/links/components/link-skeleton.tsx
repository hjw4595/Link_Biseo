import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonStatus } from '@/components/common/skeleton-status';

export function LinkListSkeleton({
  text,
  count = 4,
  grid = false,
}: {
  text: string;
  count?: number;
  grid?: boolean;
}) {
  return (
    <SkeletonStatus text={text}>
      <div
        className={grid ? 'grid grid-cols-1 gap-x-6 lg:grid-cols-2' : undefined}
      >
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex min-h-16 items-center gap-3 py-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={index % 2 ? 'h-4 w-2/3' : 'h-4 w-4/5'} />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="size-4 shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

export function LinkDetailSkeleton({ text }: { text: string }) {
  return (
    <div className="screen-content">
      <SkeletonStatus text={text}>
        <div className="space-y-7">
          <Skeleton className="size-10" />
          <div className="space-y-3">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="space-y-5">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="grid grid-cols-[80px_minmax(0,1fr)] gap-4"
              >
                <Skeleton className="h-4 w-16" />
                <Skeleton className={row === 3 ? 'h-12 w-full' : 'h-4 w-3/4'} />
              </div>
            ))}
          </div>
        </div>
      </SkeletonStatus>
    </div>
  );
}
