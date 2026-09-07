'use client';
import { useRef, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CategoryResponse } from '@/contracts';
import { useCategoryMutation } from '@/lib/query/product';
import { categoryErrorMessage, CategoryApiError } from '@/lib/api/categories';

export function CategoryReorder({
  categories,
  onClose,
  reload,
}: {
  categories: readonly CategoryResponse[];
  onClose: () => void;
  reload: () => Promise<unknown>;
}) {
  const [original, setOriginal] = useState(() => [...categories]);
  const [draft, setDraft] = useState(() => [...categories]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const mutation = useCategoryMutation();
  const changed = draft.some((row, i) => row.id !== original[i]?.id);
  const membershipChanged =
    draft.length !== categories.length ||
    draft.some((row) => !categories.some((current) => current.id === row.id));
  const busy = mutation.isPending || refreshing;
  function move(index: number, offset: number) {
    if (busy || index + offset < 0 || index + offset >= draft.length) return;
    setDraft((current) => {
      const next = [...current];
      const other = next[index + offset];
      const moving = next[index];
      if (!other || !moving) return current;
      next[index + offset] = moving;
      next[index] = other;
      return next;
    });
  }
  async function refresh() {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }
  async function save() {
    if (pending.current || membershipChanged) return;
    if (!changed) {
      onClose();
      return;
    }
    pending.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({
        type: 'reorder',
        categoryIds: draft.map((row) => row.id),
      });
      onClose();
    } catch (reason: unknown) {
      setError(
        reason instanceof CategoryApiError && reason.kind === 'conflict'
          ? '카테고리 목록이 변경됐어요. 목록을 다시 불러와 주세요.'
          : categoryErrorMessage(reason),
      );
    } finally {
      pending.current = false;
    }
  }
  return (
    <section className="space-y-4" aria-label="카테고리 순서 변경">
      <h2 className="font-semibold">카테고리 순서 변경</h2>
      <ol className="space-y-3" aria-label="카테고리 순서">
        {draft.map((row, index) => (
          <li
            key={row.id}
            className="flex min-w-0 items-center gap-3 rounded-lg border bg-surface p-3"
          >
            <span className="w-6 shrink-0 text-center text-meta text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-list font-medium [overflow-wrap:anywhere]">
              {row.name}
            </span>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${row.name} 위로 이동`}
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden="true" className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${row.name} 아래로 이동`}
                disabled={busy || index === draft.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      {(error || membershipChanged) && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {membershipChanged
              ? '카테고리 목록이 변경됐어요. 최신 목록으로 다시 시작해 주세요.'
              : error}
          </p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              void refresh();
            }}
          >
            목록 다시 불러오기
          </Button>
          {membershipChanged && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setDraft([...categories]);
                setOriginal([...categories]);
                setError(null);
              }}
            >
              최신 목록으로 다시 시작
            </Button>
          )}
        </div>
      )}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          취소
        </Button>
        <Button
          loading={mutation.isPending}
          disabled={refreshing || membershipChanged}
          onClick={() => {
            void save();
          }}
        >
          완료
        </Button>
      </div>
    </section>
  );
}
