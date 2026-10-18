'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { useImportRun } from '../use-import-run';
import type { Outcome } from '../import-runner';

const labels: Record<Outcome, string> = {
  not_attempted: '미시도',
  importing: '진행 중',
  imported: '등록 성공',
  duplicate_server: '서버 중복',
  failed: '실패',
  unknown: '저장 여부 확인 불가',
};
export function ImportResults({
  run,
  onRestart,
}: {
  run: ReturnType<typeof useImportRun>;
  onRestart: () => void;
}) {
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [page, setPage] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const execution = run.execution;
  useEffect(() => {
    if (execution?.phase === 'finished') heading.current?.focus();
  }, [execution?.phase]);
  if (!execution) return null;
  const running = execution.phase === 'running';
  const count = (status: Outcome) =>
    execution.results.filter((row) => row.outcome === status).length;
  const done =
    execution.results.length - count('not_attempted') - count('importing');
  const rows = execution.results.filter(
    (row) =>
      !onlyProblems ||
      ['failed', 'unknown', 'not_attempted'].includes(row.outcome),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const currentPage = Math.min(page, pages - 1);
  return (
    <section className="min-w-0 space-y-4" aria-label="가져오기 실행 결과">
      <h2 ref={heading} tabIndex={-1} className="font-semibold">
        {running
          ? execution.stage === 'categories'
            ? '카테고리 준비 중'
            : '링크를 가져오고 있어요'
          : '가져오기 처리 결과'}
      </h2>
      <p role="status">
        전체 {execution.results.length}개 · 처리 완료 {done}개
      </p>
      {execution.categories.length > 0 && (
        <div className="space-y-2">
          <p>
            카테고리 생성 성공{' '}
            {
              execution.categories.filter((row) => row.status === 'created')
                .length
            }
            개 · 카테고리 실패{' '}
            {
              execution.categories.filter((row) => row.status === 'failed')
                .length
            }
            개 · 카테고리 생성 여부 미확인{' '}
            {
              execution.categories.filter((row) => row.status === 'unknown')
                .length
            }
            개
          </p>
          <ul aria-label="카테고리 준비 결과" className="space-y-2">
            {execution.categories.map((row) => (
              <li key={row.key} className="break-all text-sm">
                {row.name}:{' '}
                {
                  {
                    not_attempted: '미시도',
                    creating: '생성 중',
                    created: '생성 성공',
                    failed: '생성 실패',
                    unknown: '생성 여부 확인 불가',
                  }[row.status]
                }
                {row.reason && ` — ${row.reason}`}
              </li>
            ))}
          </ul>
          <p className="text-sm">
            생성된 카테고리는 자동 삭제하지 않아요. 이름이 같다는 이유만으로
            미확인 생성을 성공으로 확정하지 않아요.
          </p>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        이번 실행의 응답 기준 집계예요. 재조회에서 발견한 기존 링크는 등록 성공
        수에 더하지 않아요.
      </p>
      <p className="break-all text-sm">
        적용 카테고리: {execution.categoryName}
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt>기존 중복 제외</dt>
          <dd>{execution.excluded}개</dd>
        </div>
        {Object.entries(labels).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {execution.results.filter((row) => row.outcome === key).length}개
            </dd>
          </div>
        ))}
      </dl>
      {execution.reason && <p role="alert">{execution.reason}</p>}
      {!!count('unknown') && (
        <p>
          일부 저장 여부를 확인하지 못했어요. 다시 확인하기 전에는 재전송하지
          않아요.
        </p>
      )}
      {running ? (
        <Button variant="secondary" onClick={run.stop}>
          새 요청 중단
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/links">내 링크 보기</Link>
          </Button>
          <Button
            variant="secondary"
            disabled={run.checking}
            onClick={() => void run.reconcile()}
          >
            저장 여부 다시 확인
          </Button>
          <Button variant="ghost" disabled={run.checking} onClick={onRestart}>
            가져오기를 다시 시작
          </Button>
        </div>
      )}
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={onlyProblems}
          onChange={(event) => {
            setOnlyProblems(event.target.checked);
            setPage(0);
          }}
        />
        실패·미확인·미시도 항목만 확인
      </label>
      <ul className="space-y-2" aria-label="가져오기 결과 항목">
        {rows.slice(currentPage * 25, (currentPage + 1) * 25).map((row) => (
          <li
            key={row.item.localId}
            className="min-w-0 rounded-lg border p-3 text-sm"
          >
            <p className="line-clamp-2 break-all">
              {row.item.title || '제목 없음'}
            </p>
            <p>{labels[row.outcome]}</p>
            {row.reason && <p>{row.reason}</p>}
            {row.reconciliation === 'found' && row.outcome !== 'imported' && (
              <p>저장됨 확인 — 이번 요청으로 등록됐는지는 확정할 수 없어요.</p>
            )}
            {row.reconciliation === 'not_found' &&
              row.outcome === 'unknown' && (
                <p>
                  조회 시점에 찾지 못했어요. 늦은 저장 가능성은 남아 있어요.
                </p>
              )}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            이전 결과
          </Button>
          <span>
            {currentPage + 1} / {pages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={currentPage + 1 >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            다음 결과
          </Button>
        </div>
      )}
    </section>
  );
}
