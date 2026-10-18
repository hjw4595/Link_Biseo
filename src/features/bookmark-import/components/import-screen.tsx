'use client';
import Link from 'next/link';
import { useState } from 'react';
import { TopBar } from '@/components/common/top-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCategories } from '@/lib/query/product';
import { categoryErrorMessage } from '@/lib/api/categories';
import { useBookmarkImport } from '../use-bookmark-import';
import { ImportPreview } from './import-preview';
import { useImportRun } from '../use-import-run';
import { ImportResults } from './import-results';
import { FolderMapping } from './folder-mapping';
import { emptyMapping, mappingPlan } from '../folder-mapping';

export function ImportScreen() {
  const preview = useBookmarkImport();
  const categories = useCategories();
  const [mapping, setMapping] = useState(emptyMapping);
  const plan = mappingPlan(
    preview.items,
    preview.selected,
    mapping,
    categories.isSuccess ? categories.data : undefined,
  );
  const run = useImportRun(
    preview,
    plan,
    async () => {
      const result = await categories.refetch({ throwOnError: true });
      if (!result.data) throw new Error('Categories unavailable');
      return result.data;
    },
    (key, category) =>
      setMapping((previous) => ({
        ...previous,
        targets: {
          ...previous.targets,
          [key]: { kind: 'existing', id: category.id },
        },
      })),
    (key) =>
      setMapping((previous) => {
        const target = previous.targets[key];
        return target?.kind === 'create'
          ? {
              ...previous,
              targets: {
                ...previous.targets,
                [key]: { ...target, reviewRequired: true },
              },
            }
          : previous;
      }),
  );
  const running = run.execution?.phase === 'running';
  const showPreview = !run.execution || run.retryReady;
  return (
    <>
      <TopBar
        title="북마크 가져오기"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link
              href="/links"
              onNavigate={(event) => {
                if (!run.allowNavigation()) event.preventDefault();
              }}
            >
              내 링크
            </Link>
          </Button>
        }
      />
      <div className="screen-content min-w-0">
        <p className="rounded-lg border border-border p-4 text-sm">
          개발 미리보기: 선택 후 명시적으로 실행하면 링크가 등록돼요. 운영 공개
          전 검증 중이에요.
        </p>
        <p className="text-sm text-muted-foreground">
          다른 화면으로 이동하거나 새로고침하면 작업이 중단되고 결과가 사라질 수
          있어요. 이미 시작된 서버 저장은 취소되지 않을 수 있어요.
        </p>
        <div className="space-y-3">
          <h1 className="text-hero font-semibold">브라우저 북마크 가져오기</h1>
          <p className="text-muted-foreground">
            Chrome, Edge, Firefox에서 내보낸 북마크 HTML 파일을 선택하세요.
          </p>
          <details>
            <summary className="cursor-pointer py-2">
              브라우저에서 내보내는 방법
            </summary>
            <p className="text-sm leading-relaxed">
              Chrome·Edge는 북마크(즐겨찾기) 관리자의 메뉴에서 HTML 내보내기를
              선택하세요. Firefox는 북마크 관리 창의 가져오기 및 백업 메뉴에서
              HTML로 내보내기를 선택하세요.
            </p>
          </details>
          <p id="file-limits" className="text-meta text-muted-foreground">
            UTF-8 HTML · 최대 1 MiB · 북마크 500개 · 폴더 깊이 32 · 분석 노드
            20,000개. 파일은 이 화면의 메모리에서만 처리해요.
          </p>
          <label htmlFor="bookmark-file" className="block font-medium">
            HTML 파일 선택
          </label>
          <Input
            id="bookmark-file"
            type="file"
            disabled={!preview.ready || !!run.execution || run.checking}
            accept=".html,.htm,text/html"
            className="h-auto min-w-0 py-3 text-sm"
            aria-describedby="file-limits"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file && run.reset()) {
                setMapping(emptyMapping());
                void preview.selectFile(file);
              }
            }}
          />
          {preview.fileName && (
            <p className="break-all text-sm">선택한 파일: {preview.fileName}</p>
          )}
        </div>
        {preview.error && (
          <p role="alert" className="text-destructive">
            {preview.error}
          </p>
        )}
        {preview.phase === 'parsing' && (
          <p role="status" aria-live="polite">
            북마크를 분석하고 있어요…
          </p>
        )}
        {preview.phase === 'reviewing' && (
          <>
            <ImportResults
              key={run.execution?.id ?? 'empty'}
              run={run}
              onRestart={() => {
                if (run.reset()) {
                  preview.clear();
                  setMapping(emptyMapping());
                }
              }}
            />
            {run.message && <p role="status">{run.message}</p>}
            {run.checking && (
              <p role="status">저장 여부를 다시 확인하고 있어요…</p>
            )}
            {showPreview && (
              <>
                {preview.scan.status === 'loading' && (
                  <p role="status">
                    기존 저장 링크를 확인하고 있어요. 아직 신규 여부를 확정하지
                    않았어요.
                  </p>
                )}
                {preview.scan.status === 'incomplete' && (
                  <div className="space-y-2">
                    <p role="alert" className="text-destructive">
                      기존 링크 확인 미완료: {preview.scan.reason} 신규 여부를
                      확정하지 않았어요.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        void preview.recheck();
                      }}
                    >
                      기존 링크 다시 확인
                    </Button>
                  </div>
                )}
                {preview.scan.status === 'complete' && (
                  <p role="status" className="text-sm text-muted-foreground">
                    기존 링크 {preview.scan.count}개 확인 완료. 다른 기기에서
                    변경한 내용은 다를 수 있어요.
                  </p>
                )}
                <div
                  className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
                  data-testid="import-workspace"
                >
                  <ImportPreview
                    key={preview.items[0]?.localId ?? preview.fileName}
                    items={preview.items}
                    complete={preview.scan.status === 'complete'}
                    selected={preview.selected}
                    onSelect={preview.select}
                    onSelectAll={preview.selectAll}
                  />
                  <div className="min-w-0 space-y-5">
                    <FolderMapping
                      key={`mapping:${preview.items[0]?.localId ?? preview.fileName}`}
                      items={preview.items}
                      selected={preview.selected}
                      config={mapping}
                      plan={plan}
                      categories={categories.data ?? []}
                      disabled={
                        !categories.isSuccess ||
                        preview.scan.status !== 'complete' ||
                        running ||
                        run.checking
                      }
                      onChange={setMapping}
                      onSelectGroup={preview.selectGroup}
                    />
                    {categories.isPending && (
                      <p role="status">카테고리를 불러오고 있어요.</p>
                    )}
                    {categories.error && (
                      <p role="alert">
                        {categoryErrorMessage(categories.error)}
                      </p>
                    )}
                    {categories.error && (
                      <Button
                        variant="secondary"
                        onClick={() => void categories.refetch()}
                      >
                        카테고리 다시 확인
                      </Button>
                    )}
                    <section
                      className="space-y-3 rounded-lg border p-4"
                      aria-label="가져오기 실행 확인"
                    >
                      <h2 className="font-semibold">선택 내용 확인</h2>
                      <p>
                        선택 {preview.selected.size}개 · 예상 등록 요청{' '}
                        {preview.selected.size}개
                      </p>
                      <p className="break-all">
                        적용 카테고리: {plan.categoryName}
                      </p>
                      <ul
                        aria-label="최종 카테고리 매핑"
                        className="space-y-1 text-sm"
                      >
                        {plan.rows.map((row) => (
                          <li key={row.key} className="break-all">
                            {row.label}: {row.description} · {row.count}개
                            {row.error && ' — 확인 필요'}
                          </li>
                        ))}
                      </ul>
                      <p>
                        새 카테고리{' '}
                        {
                          plan.rows.filter(
                            (row) => row.target.kind === 'create',
                          ).length
                        }
                        개 · 미분류{' '}
                        {plan.rows
                          .filter((row) => row.target.kind === 'uncategorized')
                          .reduce((sum, row) => sum + row.count, 0)}
                        개
                      </p>
                      <p>
                        파일 내부 중복{' '}
                        {
                          preview.items.filter(
                            (item) => item.eligibility === 'duplicate_in_file',
                          ).length
                        }
                        개 · 기존 저장 중복{' '}
                        {
                          preview.items.filter(
                            (item) => item.eligibility === 'duplicate_existing',
                          ).length
                        }
                        개
                      </p>
                      <p>
                        중복 제외{' '}
                        {
                          preview.items.filter((item) =>
                            item.eligibility.startsWith('duplicate'),
                          ).length
                        }
                        개
                      </p>
                      <Button
                        disabled={!run.canStart || running}
                        onClick={() => void run.start()}
                      >
                        선택한 링크 가져오기
                      </Button>
                      {!run.canStart && (
                        <p className="text-sm text-muted-foreground">
                          전체 비교와 카테고리 확인을 완료하고 신규 후보
                          1~50개를 선택하세요.
                        </p>
                      )}
                    </section>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
