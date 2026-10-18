'use client';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { useRequestScope } from '@/lib/query/provider';
import { queryKeys } from '@/lib/query/keys';
import { markUsageSummaryStale } from '@/lib/query/usage-summary';
import { markOrganizationReportsStale } from '@/lib/query/organization';
import { createClient } from '@/lib/supabase/client';
import { saveLink } from '@/lib/api/links';
import { ApiRequestError } from '@/lib/api/client';
import type { CategoryResponse } from '@/contracts/categories';
import {
  saveCategory,
  CategoryApiError,
  categoryErrorMessage,
} from '@/lib/api/categories';
import type { MappingPlan, CategoryPreparation } from './folder-mapping';
import { useNavigationGuard } from '@/components/common/navigation-guard';
import {
  runImport,
  type ItemResult,
  type RunControl,
  type RunItem,
} from './import-runner';
import type { useBookmarkImport } from './use-bookmark-import';
import { MAX_SELECTION } from './types';

interface Execution {
  id: number;
  categoryName: string;
  excluded: number;
  results: ItemResult[];
  phase: 'running' | 'finished';
  stage: 'categories' | 'links';
  categories: CategoryPreparation[];
  reason?: string;
}

export function useImportRun(
  preview: ReturnType<typeof useBookmarkImport>,
  plan: MappingPlan,
  refreshCategories: () => Promise<CategoryResponse[]>,
  onCreated: (key: string, category: CategoryResponse) => void,
  onCategoryIssue: (key: string) => void,
) {
  const { user } = useAuth();
  const scope = useRequestScope();
  const cache = useQueryClient();
  const guard = useNavigationGuard();
  const [execution, setExecution] = useState<Execution | null>(null);
  const [retryReady, setRetryReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lock = useRef(false);
  const serial = useRef(0);
  const active = useRef<{
    controller: AbortController;
    account: AbortSignal;
    control: RunControl;
    userId: string;
  } | null>(null);
  const knownSaved = useRef(new Map<string, string>());

  function invalidate(userId: string) {
    void Promise.all([
      cache.invalidateQueries({ queryKey: queryKeys.categorySummary(userId) }),
      cache.invalidateQueries({ queryKey: queryKeys.lists(userId) }),
      cache.invalidateQueries({ queryKey: queryKeys.cleanup(userId) }),
    ]).catch(() => {}); // Query failure cannot undo a committed POST.
  }
  useEffect(
    () => () => {
      serial.current++;
      const run = active.current;
      if (run) {
        run.control.stopped = true;
        run.controller.abort();
        // A navigation abort cannot establish whether dispatched writes committed.
        if (!run.account.aborted) {
          markOrganizationReportsStale(cache, run.userId);
          markUsageSummaryStale(cache, run.userId);
          void Promise.all([
            cache.invalidateQueries({ queryKey: queryKeys.lists(run.userId) }),
            cache.invalidateQueries({
              queryKey: queryKeys.cleanup(run.userId),
            }),
            cache.invalidateQueries({
              queryKey: queryKeys.categories(run.userId),
            }),
          ]).catch(() => {});
        }
      }
    },
    [cache],
  );

  useEffect(() => {
    if (execution?.phase !== 'running') return;
    const unregister = guard.register(() => {
      if (
        !window.confirm(
          '새 요청을 중단하고 이동할까요? 이미 시작된 저장은 취소되지 않을 수 있고 결과는 사라져요.',
        )
      )
        return false;
      if (active.current) active.current.control.stopped = true;
      return true;
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unregister();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [execution?.phase, guard]);

  const canStart =
    preview.phase === 'reviewing' &&
    preview.scan.status === 'complete' &&
    plan.valid &&
    preview.selected.size > 0 &&
    preview.selected.size <= MAX_SELECTION &&
    (!execution || retryReady) &&
    !checking &&
    execution?.phase !== 'running' &&
    [...preview.selected].every((id) =>
      preview.items.some(
        (item) =>
          item.localId === id &&
          item.eligibility === 'ready' &&
          item.comparisonKey,
      ),
    );

  async function start() {
    if (lock.current || !canStart || !preview.isCurrent(preview.items)) return;
    if (
      preview.items.some(
        (item) =>
          preview.selected.has(item.localId) &&
          item.comparisonKey &&
          knownSaved.current.has(item.comparisonKey),
      )
    )
      return;
    const account = scope();
    if (account.aborted) return;
    lock.current = true; // Synchronous, before the first await or React render.
    const id = ++serial.current;
    const capturedUserId = user.id;
    const controller = new AbortController();
    const control: RunControl = { stopped: false };
    active.current = { controller, account, control, userId: capturedUserId };
    const signal = AbortSignal.any([account, controller.signal]);
    const targets = plan.rows.map((row) => ({
      ...row,
      target: { ...row.target },
    }));
    const itemTargets = new Map(plan.itemTargets);
    const resolved = new Map<string, string | null>();
    for (const row of targets) {
      if (row.target.kind !== 'create')
        resolved.set(
          row.key,
          row.target.kind === 'existing' ? row.target.id : null,
        );
    }
    let snapshot: readonly RunItem[] = Object.freeze(
      preview.items
        .filter((item) => preview.selected.has(item.localId))
        .map((item) =>
          Object.freeze({
            localId: item.localId,
            title: item.originalTitle,
            key: item.comparisonKey ?? '',
            input: Object.freeze({
              url: item.originalUrl,
              categoryId:
                resolved.get(itemTargets.get(item.localId) ?? '') ?? null,
              customTitle: item.importTitle,
            }),
          }),
        ),
    );
    const live = () =>
      serial.current === id &&
      !signal.aborted &&
      preview.isCurrent(preview.items);
    setRetryReady(false);
    setMessage(null);
    setExecution({
      id,
      categoryName: plan.categoryName,
      excluded: preview.items.filter((item) =>
        item.eligibility.startsWith('duplicate'),
      ).length,
      phase: 'running',
      stage: targets.some((row) => row.target.kind === 'create')
        ? 'categories'
        : 'links',
      categories: targets.flatMap((row) =>
        row.target.kind === 'create'
          ? [
              {
                key: row.key,
                name: row.target.name,
                status: 'not_attempted' as const,
              },
            ]
          : [],
      ),
      results: snapshot.map((item) => ({ item, outcome: 'not_attempted' })),
    });
    const publishCategory = (result: CategoryPreparation) => {
      if (!live()) return;
      setExecution((previous) =>
        previous?.id === id
          ? {
              ...previous,
              categories: previous.categories.map((row) =>
                row.key === result.key ? result : row,
              ),
            }
          : previous,
      );
    };
    let categoryWrites = false;
    for (const row of targets) {
      if (!live() || control.stopped) break;
      if (row.target.kind !== 'create') continue;
      const task = { key: row.key, name: row.target.name };
      publishCategory({ ...task, status: 'creating' });
      categoryWrites = true;
      try {
        const category = await boundedSave(signal, (inner) =>
          saveCategory(
            createClient(),
            capturedUserId,
            { name: task.name },
            undefined,
            inner,
            { retryUnauthorized: false, expectedStatus: 201 },
          ),
        );
        if (!live()) return;
        if (category.name !== task.name) throw new ApiRequestError('invalid');
        resolved.set(row.key, category.id);
        publishCategory({
          ...task,
          status: 'created',
          categoryId: category.id,
        });
        onCreated(row.key, category);
        cache.setQueryData<CategoryResponse[]>(
          queryKeys.categories(capturedUserId),
          (previous) => [
            ...(previous ?? []).filter((value) => value.id !== category.id),
            category,
          ],
        );
        markOrganizationReportsStale(cache, capturedUserId);
      } catch (error) {
        if (!live()) return;
        const definite =
          error instanceof CategoryApiError ||
          (error instanceof ApiRequestError &&
            (error.status === 401 ||
              error.status === 403 ||
              error.kind === 'configuration'));
        publishCategory({
          ...task,
          status: definite ? 'failed' : 'unknown',
          reason: categoryErrorMessage(error),
        });
        onCategoryIssue(row.key);
        control.stopped = true;
        control.reason =
          '카테고리 준비를 완료하지 못해 링크 등록을 시작하지 않았어요. 목록을 다시 확인하고 매핑을 직접 선택하세요.';
        if (!definite) markOrganizationReportsStale(cache, capturedUserId);
      }
    }
    if (!live()) return;
    if (categoryWrites)
      void cache
        .invalidateQueries({ queryKey: queryKeys.categories(capturedUserId) })
        .catch(() => {});
    if (!control.stopped && targets.every((row) => resolved.has(row.key))) {
      snapshot = Object.freeze(
        snapshot.map((item) =>
          Object.freeze({
            ...item,
            input: Object.freeze({
              ...item.input,
              categoryId:
                resolved.get(itemTargets.get(item.localId) ?? '') ?? null,
            }),
          }),
        ),
      );
      setExecution((previous) =>
        previous?.id === id
          ? {
              ...previous,
              stage: 'links',
              results: snapshot.map((item) => ({
                item,
                outcome: 'not_attempted',
              })),
            }
          : previous,
      );
      await runImport(
        snapshot,
        control,
        live,
        (item) =>
          boundedSave(signal, (inner) =>
            saveLink(
              createClient(),
              capturedUserId,
              item.input,
              undefined,
              inner,
              { retryUnauthorized: false, expectedStatus: 201 },
            ),
          ),
        (result) => {
          if (!live()) return;
          setExecution((previous) =>
            previous?.id === id
              ? {
                  ...previous,
                  results: previous.results.map((row) =>
                    row.item.localId === result.item.localId ? result : row,
                  ),
                }
              : previous,
          );
          if (result.outcome === 'imported' && result.savedLinkId)
            knownSaved.current.set(result.item.key, result.savedLinkId);
          if (result.outcome === 'imported' || result.outcome === 'unknown') {
            markOrganizationReportsStale(cache, capturedUserId);
            markUsageSummaryStale(cache, capturedUserId);
          }
        },
        () => {
          void refreshCategories().catch(() => {});
        },
      );
    }
    if (!live()) return;
    active.current = null;
    lock.current = false;
    setMessage(null);
    setExecution((previous) =>
      previous?.id === id
        ? { ...previous, phase: 'finished', reason: control.reason }
        : previous,
    );
    invalidate(capturedUserId);
  }

  function stop() {
    const run = active.current;
    if (run) {
      run.control.stopped = true;
      run.control.reason = '사용자가 새 요청을 중단했어요.';
      setMessage(
        '새 요청은 중단했어요. 이미 진행 중인 요청의 결과를 기다리고 있어요.',
      );
    }
  }

  async function reconcile() {
    if (lock.current || checking) return;
    lock.current = true;
    const id = serial.current;
    const account = scope();
    setChecking(true);
    setRetryReady(false);
    setMessage(null);
    try {
      await refreshCategories();
    } catch {
      if (serial.current !== id || account.aborted) return;
      lock.current = false;
      setChecking(false);
      setMessage('카테고리 목록을 다시 확인하지 못해 재시도할 수 없어요.');
      return;
    }
    if (serial.current !== id || account.aborted) return;
    const index = await preview.recheck(knownSaved.current, false);
    if (serial.current !== id || account.aborted) return;
    lock.current = false;
    setChecking(false);
    if (!index) {
      setMessage('전체 조회가 끝나지 않아 재시도할 수 없어요.');
      return;
    }
    for (const [key, savedId] of index) knownSaved.current.set(key, savedId);
    setExecution((previous) =>
      previous
        ? {
            ...previous,
            results: previous.results.map((row) => ({
              ...row,
              reconciliation: index.has(row.item.key) ? 'found' : 'not_found',
            })),
          }
        : previous,
    );
    setRetryReady(true);
    setMessage(
      '저장 여부를 다시 확인했어요. 남은 항목을 직접 선택하세요. 미확인 요청이 나중에 저장될 가능성은 있어요.',
    );
  }

  function reset() {
    if (lock.current) return false;
    serial.current++;
    setExecution(null);
    setRetryReady(false);
    setMessage(null);
    knownSaved.current.clear();
    return true;
  }
  return {
    execution,
    canStart,
    start,
    stop,
    reconcile,
    checking,
    retryReady,
    message,
    reset,
    allowNavigation: guard.allow,
  };
}

// Bound SDK/session + response-body waits as well as fetch. Never resend on expiry.
async function boundedSave<T>(
  scope: AbortSignal,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const signal = AbortSignal.any([scope, AbortSignal.timeout(15_000)]);
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(new ApiRequestError(scope.aborted ? 'aborted' : 'timeout'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    void work(signal).then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}
