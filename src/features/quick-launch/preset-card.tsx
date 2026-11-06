'use client';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, ChevronDown, LoaderCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { usePreset } from '@/lib/query/quick-launch';
import { queryKeys } from '@/lib/query/keys';
import { useAuth } from '@/features/auth/auth-provider';
import { PresetApiError, presetErrorMessage } from '@/lib/api/quick-launch';
import { ApiRequestError } from '@/lib/api/client';
import { ExternalLink } from '@/features/links/components/external-link';
import { usePresetLaunch } from './use-preset-launch';
import type { PresetSummary } from '@/contracts/quick-launch';
import { useVisiblePreset } from './use-visible-preset';

export function PresetCard({
  preset,
  preload,
  expanded,
  toggle,
  reveal,
  edit,
}: {
  preset: PresetSummary;
  preload: boolean;
  expanded: boolean;
  toggle: () => void;
  reveal: () => void;
  edit: (trigger: HTMLButtonElement) => void;
}) {
  const { element, visible } = useVisiblePreset();
  const active = preload || visible || expanded;
  const detail = usePreset(preset.id, active);
  const launch = usePresetLaunch();
  const { user } = useAuth();
  const cache = useQueryClient();
  const toggleButton = useRef<HTMLButtonElement>(null);
  // Only a newer server summary triggers this effect. Elapsed cache age is
  // deliberately not an execution expiry or a polling trigger.
  const revalidated = useRef('');
  const outdated = !!detail.data && detail.data.updatedAt < preset.updatedAt;
  const { data, isFetching, isError, refetch } = detail;
  const unavailable =
    (detail.error instanceof PresetApiError && detail.error.status === 404) ||
    (detail.error instanceof ApiRequestError &&
      ['unauthorized', 'forbidden'].includes(detail.error.kind));
  useEffect(() => {
    if (unavailable)
      void cache.invalidateQueries({ queryKey: queryKeys.presetList(user.id) });
  }, [unavailable, cache, user.id]);
  useEffect(() => {
    const ticket = `summary:${preset.updatedAt}`;
    if (
      visible &&
      data &&
      !isFetching &&
      !isError &&
      outdated &&
      revalidated.current !== ticket
    ) {
      revalidated.current = ticket;
      void refetch();
    }
  }, [visible, data, isFetching, isError, refetch, preset.updatedAt, outdated]);
  const ready =
    active &&
    detail.isSuccess &&
    !detail.isFetching &&
    !detail.isError &&
    !cache.getQueryState(queryKeys.preset(user.id, preset.id))?.isInvalidated &&
    !outdated;
  const initialLoading = !detail.data && detail.isFetching;
  const links = detail.data
    ? detail.data.links
        .toSorted((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.link)
    : [];
  const panelId = `preset-panel-${preset.id}`;
  const canExecute = () => {
    const current = cache.getQueryState(queryKeys.preset(user.id, preset.id));
    return (
      ready &&
      current?.status === 'success' &&
      !current.isInvalidated &&
      current.fetchStatus === 'idle' &&
      current.data === detail.data
    );
  };
  return (
    <li
      ref={element}
      className="surface-card min-w-0"
      aria-label={`빠른 실행 ${preset.name}`}
    >
      <div className="flex min-h-22 items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <h3
            title={preset.name}
            className="line-clamp-2 text-list font-semibold [overflow-wrap:anywhere]"
          >
            {preset.name}
          </h3>
          <button
            ref={toggleButton}
            type="button"
            className="flex min-h-11 items-center gap-1 rounded-sm text-meta text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={`${preset.name} ${expanded ? '접기' : '펼치기'}`}
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={toggle}
          >
            링크 {preset.linkCount}개
            <ChevronDown
              className={cn('size-4', expanded && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
        </div>
        <Button
          size="sm"
          aria-busy={initialLoading || undefined}
          aria-describedby={`preset-state-${preset.id}`}
          disabled={!ready || !links.length || launch.locked}
          onClick={() => {
            if (!canExecute()) return;
            reveal();
            launch.launch(links);
          }}
        >
          {initialLoading ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <Play aria-hidden="true" />
          )}
          실행
        </Button>
      </div>
      <p id={`preset-state-${preset.id}`} role="status" className="sr-only">
        {detail.isFetching
          ? '포함된 링크를 불러오는 중이에요.'
          : detail.error || outdated
            ? '포함된 링크를 확인하지 못했어요.'
            : !ready
              ? '포함된 링크를 확인하고 있어요.'
              : !links.length
                ? '포함된 링크가 없어 실행할 수 없어요.'
                : launch.locked
                  ? '링크 열기를 요청하고 있어요.'
                  : '실행할 수 있어요.'}
      </p>
      {(detail.error || (outdated && !detail.isFetching)) && (
        <div role="alert" className="space-y-2 px-3 pb-3">
          <p>
            {detail.error
              ? presetErrorMessage(detail.error)
              : '변경된 빠른 실행 정보를 확인하지 못했어요.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            loading={detail.isFetching}
            onClick={() => {
              void detail.refetch();
            }}
          >
            다시 불러오기
          </Button>
        </div>
      )}
      <div id={panelId} hidden={!expanded} className="space-y-3 border-t p-3">
        {initialLoading && <p>포함된 링크를 불러오는 중이에요.</p>}
        {detail.data && !links.length && (
          <p className="text-muted-foreground">
            포함된 링크가 없어요. 편집에서 링크를 추가해 주세요.
          </p>
        )}
        {links.length > 0 && (
          <>
            <p className="text-meta text-muted-foreground">
              {links.length > 8
                ? `현재 ${links.length}개 · 신규 최대 8개`
                : `포함 링크 ${links.length}개`}
            </p>
            <ul
              onClickCapture={(event) => {
                if (!canExecute()) event.preventDefault();
              }}
              onAuxClickCapture={(event) => {
                if (!canExecute()) event.preventDefault();
              }}
              tabIndex={links.length > 8 ? 0 : undefined}
              aria-label={`${preset.name} 포함 링크`}
              className={cn(
                'space-y-1',
                links.length > 8 &&
                  'max-h-[min(280px,40dvh)] overflow-y-auto overscroll-contain rounded-sm',
              )}
            >
              {links.map((link, index) => {
                const result = launch.results.find(
                  (row) => row.link.id === link.id,
                );
                return (
                  <li key={link.id} className="border-b">
                    <ExternalLink
                      link={link}
                      disabled={!ready || (launch.incognito && launch.locked)}
                      newTab
                      onActivate={() => launch.recordIndividual(link)}
                      label={`${link.title} 개별 열기`}
                      className="flex min-h-16 w-full items-center gap-3 rounded-sm py-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span
                        aria-hidden="true"
                        className="text-meta text-muted-foreground"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 [overflow-wrap:anywhere]">
                          {link.title}
                        </p>
                        <p className="truncate text-meta text-muted-foreground">
                          {link.domain}
                        </p>
                        {result?.record === 'unverified' && (
                          <p role="status" className="text-meta">
                            사용 기록 저장 여부를 확인할 수 없어요. 탭을
                            자동으로 다시 열지 않아요.
                          </p>
                        )}
                        {result?.record === 'skipped' && (
                          <p className="text-meta">
                            열기 요청을 보내지 않았어요.
                          </p>
                        )}
                      </div>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    </ExternalLink>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {launch.results.length > 0 && (
          <div aria-live="polite" className="space-y-1">
            <p>
              {launch.results.some((row) => row.attempted)
                ? '링크 열기를 요청했어요.'
                : '열기 요청을 보내지 못했어요. 링크 URL을 확인해 주세요.'}
            </p>
            <p className="text-meta text-muted-foreground">
              {launch.secretResult
                ? '시크릿 창 생성이 확인됐어요. 페이지 방문 완료를 의미하지는 않아요.'
                : '브라우저 설정에 따라 일부 탭이 열리지 않을 수 있어요. 직접 다시 열면 탭이 중복될 수 있어요.'}
            </p>
          </div>
        )}
        {launch.error && <p role="alert">{launch.error}</p>}
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => edit(event.currentTarget)}
          >
            편집
          </Button>
        </div>
      </div>
    </li>
  );
}
