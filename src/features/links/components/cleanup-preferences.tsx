'use client';
import { usePreferences, usePreferenceMutation } from '@/lib/query/cleanup';
import { RequestError } from '@/components/common/request-error';
import { linkErrorMessage } from '@/lib/api/links';
import { isCleanupThreshold } from '@/contracts/cleanup';
export function CleanupPreferences() {
  const query = usePreferences(),
    mutation = usePreferenceMutation();
  return (
    <section className="space-y-3" aria-labelledby="link-management">
      <h2 id="link-management" className="font-semibold">
        링크 관리 설정
      </h2>
      {query.error ? (
        <RequestError
          text="링크 정리 설정을 불러오지 못했어요."
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <div className="grid min-w-0 gap-3 lg:grid-cols-[1fr_176px] lg:items-center">
            <label htmlFor="cleanup-threshold" className="block">
              미사용 링크 추천 기간
            </label>
            <select
              id="cleanup-threshold"
              aria-describedby="cleanup-description"
              className="min-h-12 w-full rounded-md border bg-surface px-3"
              disabled={!query.data || mutation.isPending}
              value={
                query.data ? (query.data.cleanupThresholdDays ?? 'off') : ''
              }
              onChange={(event) => {
                const value =
                  event.target.value === 'off'
                    ? null
                    : Number(event.target.value);
                if (isCleanupThreshold(value)) mutation.mutate(value);
              }}
            >
              {!query.data && <option value="">불러오는 중…</option>}
              <option value="7">7일</option>
              <option value="14">14일</option>
              <option value="30">30일</option>
              <option value="off">사용 안함</option>
            </select>
          </div>
          <p
            id="cleanup-description"
            className="text-meta text-muted-foreground"
          >
            설정한 기간 동안 사용하지 않은 링크를 비서의 추천에서 정리 후보로
            확인할 수 있어요.
          </p>
          {mutation.error && (
            <p role="alert" className="text-destructive">
              {linkErrorMessage(mutation.error)}
            </p>
          )}
          <p role="status" className="text-meta text-muted-foreground">
            {mutation.isPending
              ? '저장 중…'
              : mutation.isSuccess
                ? '저장했어요.'
                : ''}
          </p>
        </>
      )}
    </section>
  );
}
