import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonStatus } from './skeleton-status';
import { cn } from '@/lib/utils';

export type ContentSkeletonVariant =
  'list' | 'cards' | 'detail' | 'form' | 'value' | 'chart';

/** Content only: callers keep their page/section headings and controls mounted. */
export function ContentSkeleton({
  text,
  variant = 'list',
  count = 4,
  compact = false,
  grid = false,
  className,
}: {
  text: string;
  variant?: ContentSkeletonVariant;
  count?: number;
  compact?: boolean;
  grid?: boolean;
  className?: string;
}) {
  return (
    <SkeletonStatus text={text}>
      <div className={cn('min-w-0', className)}>
        {variant === 'value' ? (
          <Skeleton className="h-8 w-20 max-w-full bg-surface-raised" />
        ) : variant === 'chart' ? (
          <div className="flex min-h-56 flex-col items-center gap-6 sm:flex-row">
            <Skeleton className="size-40 shrink-0 rounded-full" />
            <div className="w-full flex-1 space-y-4">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </div>
        ) : variant === 'detail' ? (
          <div className="space-y-6 py-4">
            <Skeleton className="size-10" />
            <div className="space-y-3">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-20 w-full" />
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[80px_minmax(0,1fr)] gap-4"
                >
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ) : variant === 'form' ? (
          <div className="space-y-6">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : variant === 'cards' ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="surface-card min-w-0 space-y-3 p-4">
                <Skeleton className="h-5 w-1/2 bg-surface-raised" />
                <Skeleton className="h-4 w-1/3 bg-surface-raised" />
              </div>
            ))}
          </div>
        ) : (
          <div
            className={cn(
              grid
                ? 'grid grid-cols-1 gap-x-6 lg:grid-cols-2'
                : compact
                  ? 'divide-y divide-border'
                  : undefined,
            )}
          >
            {Array.from({ length: count }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-3',
                  compact && !grid ? 'min-h-14 px-1 py-1.5' : 'min-h-16 py-3',
                )}
              >
                {!compact && (
                  <Skeleton className="size-10 shrink-0 rounded-lg" />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className={i % 2 ? 'h-4 w-2/3' : 'h-4 w-4/5'} />
                  {!compact && <Skeleton className="h-3 w-2/5" />}
                </div>
                <Skeleton className="size-5 shrink-0" />
                {compact && <Skeleton className="h-4 w-10 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </SkeletonStatus>
  );
}
