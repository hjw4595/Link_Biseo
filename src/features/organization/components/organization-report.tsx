'use client';
import { LinkRegistrationLink } from '@/features/links/components/link-registration';
import { TopBar } from '@/components/common/top-bar';
import { Button } from '@/components/ui/button';
import { RequestError } from '@/components/common/request-error';
import { EmptyState } from '@/components/common/empty-state';
import { organizationErrorMessage } from '@/lib/api/organization';
import { useOrganizationReport } from '../use-organization-report';
import { reportToRecommendations } from '../adapters/report-to-recommendations';
import { RecommendationList } from './recommendation-list';

export function OrganizationReport() {
  const { data, stale, error, pending, run, ready } = useOrganizationReport();
  const report = data?.report;
  const items = report ? reportToRecommendations(report) : [];
  return (
    <>
      <TopBar
        title="비서의 추천"
        backHref="/links"
        action={
          <Button variant="ghost" disabled={pending || !ready} onClick={run}>
            {pending ? '분석 중' : report ? '다시 분석' : '추천 확인하기'}
          </Button>
        }
      />
      <div className="screen-content">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">지금 정리할 부분을 살펴봐요</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            저장한 링크의 분류, 사용 기록과 정보 수집 상태를 기준으로 정리할
            부분을 모았어요.
          </p>
        </div>
        {pending && (
          <p role="status" className="text-sm text-muted-foreground">
            추천을 준비하고 있어요.
          </p>
        )}
        {error && !pending && (
          <RequestError
            text={`${organizationErrorMessage(error)}${report ? ' 이전 결과를 표시해요.' : ''}`}
            retry={run}
          />
        )}
        {!report && !pending && !error && (
          <EmptyState
            title="원할 때 추천을 확인하세요"
            description="버튼을 누르면 내 링크에서 정리할 부분을 찾아요."
          />
        )}
        {report && (
          <>
            <p className="text-meta text-muted-foreground">
              {stale || error ? '이전 결과 · ' : ''}분석 시각{' '}
              <time dateTime={report.asOf}>
                {new Intl.DateTimeFormat('ko-KR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: report.timeZone,
                }).format(new Date(report.asOf))}
              </time>{' '}
              · {report.timeZone}
            </p>
            {stale && (
              <p role="status" className="text-sm text-muted-foreground">
                링크 정보나 정리 기준이 변경됐어요. 다시 확인해 주세요.
              </p>
            )}
            {report.cleanupCandidates.thresholdDays === null && (
              <p role="status" className="text-meta text-muted-foreground">
                분석 당시 미사용 링크 추천이 꺼져 있었어요. 다른 정리 항목은
                계속 확인할 수 있어요.
              </p>
            )}
            {report.summary.totalLinks === 0 ? (
              <EmptyState
                title="아직 저장된 링크가 없어요"
                description="링크를 추가하고 내 링크를 채워 보세요."
                action={
                  <Button asChild variant="secondary">
                    <LinkRegistrationLink href="/links/new">
                      링크 추가하기
                    </LinkRegistrationLink>
                  </Button>
                }
              />
            ) : items.length === 0 ? (
              <EmptyState
                title="지금 확인할 정리 항목이 없어요"
                description="분석 시점에는 정리할 항목이 없었어요."
              />
            ) : (
              <RecommendationList key={report.asOf} items={items} />
            )}
            <p className="text-meta text-muted-foreground">
              분석 당시 전체 링크 {report.summary.totalLinks}개 · 카테고리{' '}
              {report.summary.totalCategories}개
            </p>
          </>
        )}
      </div>
    </>
  );
}
