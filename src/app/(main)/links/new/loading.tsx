import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonStatus } from '@/components/common/skeleton-status';
export default function Loading() {
  return (
    <div className="screen-content">
      <SkeletonStatus text="링크 추가 화면을 불러오고 있어요.">
        <div className="space-y-8">
          <Skeleton className="h-6 w-24" />
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
          <Skeleton className="h-12 w-full" />
        </div>
      </SkeletonStatus>
    </div>
  );
}
