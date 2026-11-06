'use client';
import type { useLinkStats } from '@/lib/query/product';
import { RequestError } from '@/components/common/request-error';
import { ContentSkeleton } from '@/components/common/content-skeleton';

export function LinkUsage({
  stats,
  today,
}: {
  stats: ReturnType<typeof useLinkStats>;
  today: string | null;
}) {
  return (
    <section
      aria-labelledby="usage-heading"
      className="space-y-3 border-b pb-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="usage-heading" className="font-semibold">
          사용 빈도
        </h2>
        <span className="text-meta text-muted-foreground">최근 7일</span>
      </div>
      {stats.isPending ? (
        <ContentSkeleton text="사용 통계를 불러오고 있어요." variant="value" />
      ) : stats.error ? (
        <RequestError
          text="사용 통계를 불러오지 못했어요."
          retry={() => {
            void stats.refetch();
          }}
        />
      ) : stats.data.periodEndDate !== today ? (
        <RequestError
          text="오늘의 사용 통계를 다시 확인해 주세요."
          retry={() => {
            void stats.refetch();
          }}
        />
      ) : (
        <>
          <p className="break-words" aria-live="polite">
            {stats.data.historyStatus === 'partial' && (
              <span className="text-muted-foreground">기록된 </span>
            )}
            <span className="text-hero font-semibold tabular-nums">
              {new Intl.NumberFormat('ko-KR').format(
                stats.data.recent7DayOpenCount,
              )}
            </span>
            회 열었어요
          </p>
          <p className="text-meta text-muted-foreground">
            최근 일주일 동안 서버에 기록된 링크 열기 요청 횟수입니다.
          </p>
          <p className="text-meta text-muted-foreground">
            {stats.data.periodStartDate} ~ {stats.data.periodEndDate} ·{' '}
            {stats.data.timezone}
          </p>
          {stats.data.historyStatus === 'partial' && (
            <p role="status" className="text-meta text-muted-foreground">
              이전 사용 기록이 일부 없어 기록된 횟수만 표시해요.
            </p>
          )}
        </>
      )}
    </section>
  );
}
