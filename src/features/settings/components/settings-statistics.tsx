'use client';
import { useCategories, useCategorySummary } from '@/lib/query/product';
import { useEffect, useRef } from 'react';
import { useUsageSummary } from '@/lib/query/usage-summary';
import { RequestError } from '@/components/common/request-error';
import { categoryDistribution } from '../adapters/category-distribution';
import { StatisticCard } from './statistic-card';
import { CategoryDistribution } from './category-distribution';

export function SettingsStatistics() {
  const summary = useCategorySummary();
  const categories = useCategories();
  const usage = useUsageSummary();
  const mismatch = !!(
    summary.data &&
    usage.data &&
    usage.data.recent7DayUsedLinkCount > summary.data.totalLinkCount
  );
  const recovering = useRef(false);
  const { refetch: refetchSummary, isFetching: summaryFetching } = summary;
  const { refetch: refetchUsage, isFetching: usageFetching } = usage;
  // One recovery attempt per continuous mismatch. Never clamp or poll forever.
  useEffect(() => {
    if (!mismatch) {
      recovering.current = false;
      return;
    }
    if (!recovering.current && !summaryFetching && !usageFetching) {
      recovering.current = true;
      void Promise.all([refetchSummary(), refetchUsage()]);
    }
  }, [mismatch, summaryFetching, usageFetching, refetchSummary, refetchUsage]);
  const rate =
    summary.data && usage.data && !mismatch && !summary.error && !usage.error
      ? summary.data.totalLinkCount === 0
        ? '0'
        : (
            (usage.data.recent7DayUsedLinkCount / summary.data.totalLinkCount) *
            100
          ).toFixed(1)
      : null;
  const usageValue = (value: number | undefined, unit: string) =>
    value !== undefined ? (
      `${value.toLocaleString('ko-KR')}${unit}`
    ) : usage.error ? (
      '조회 실패'
    ) : (
      <span role="status" className="text-sm">
        불러오는 중…
      </span>
    );
  const result =
    summary.data && categories.data
      ? categoryDistribution(summary.data, categories.data)
      : null;
  const retry = () => {
    void summary.refetch();
    void categories.refetch();
  };
  return (
    <>
      <section aria-labelledby="usage-statistics" className="space-y-4">
        <h2 id="usage-statistics" className="font-semibold">
          사용 통계
        </h2>
        <div className="grid min-w-0 gap-3 min-[390px]:grid-cols-3">
          <StatisticCard
            title="전체 링크"
            value={
              summary.data ? (
                `${summary.data.totalLinkCount.toLocaleString('ko-KR')}개`
              ) : summary.error ? (
                '조회 실패'
              ) : (
                <span className="text-sm" role="status">
                  불러오는 중…
                </span>
              )
            }
          />
          <StatisticCard
            title="최근 7일 사용한 링크"
            value={usageValue(usage.data?.recent7DayUsedLinkCount, '개')}
            description={rate !== null ? `전체의 ${rate}%` : undefined}
          />
          <StatisticCard
            title="최근 7일 실행"
            value={usageValue(usage.data?.recent7DayOpenCount, '회')}
          />
        </div>
        <p className="text-meta text-muted-foreground">
          현재 저장된 링크와 남아 있는 열기 기록 기준이에요. 사용한 링크는 기간
          내 한 번 이상 기록된 서로 다른 링크 수예요.
        </p>
        {usage.data && (
          <p className="text-meta text-muted-foreground">
            {usage.data.periodStartDate} ~ {usage.data.periodEndDate} ·{' '}
            {usage.data.timezone}
          </p>
        )}
        {usage.error && (
          <RequestError
            text={
              usage.data
                ? '사용 통계를 갱신하지 못했어요. 이전 조회 값을 표시하고 있어요.'
                : '사용 통계를 불러오지 못했어요.'
            }
            retrying={usage.isFetching}
            retry={() => {
              void usage.refetch();
            }}
          />
        )}
        {mismatch && (
          <RequestError
            text="전체 링크 수와 사용 통계의 조회 시점이 달라요. 다시 확인해 주세요."
            retry={() => {
              void summary.refetch();
              void usage.refetch();
            }}
          />
        )}
        {summary.error && (
          <RequestError
            text="전체 링크 수를 불러오지 못했어요."
            retry={() => {
              void summary.refetch();
            }}
          />
        )}
      </section>
      <section
        aria-labelledby="distribution-heading"
        className="min-w-0 space-y-4"
      >
        <h2 id="distribution-heading" className="font-semibold">
          카테고리별 링크 분포
        </h2>
        {categories.error && (
          <RequestError
            text="카테고리를 불러오지 못했어요."
            retry={() => {
              void categories.refetch();
            }}
          />
        )}
        {result?.status === 'ready' && summary.data ? (
          <CategoryDistribution
            items={result.items}
            total={summary.data.totalLinkCount}
          />
        ) : result ? (
          <RequestError
            text={
              result.status === 'mismatch'
                ? '카테고리 정보가 변경되었어요. 최신 정보를 다시 불러와 주세요.'
                : '카테고리 분포를 확인하지 못했어요.'
            }
            retry={retry}
          />
        ) : !summary.error && !categories.error ? (
          <p role="status" className="text-sm text-muted-foreground">
            링크 분포를 불러오는 중…
          </p>
        ) : null}
      </section>
    </>
  );
}
