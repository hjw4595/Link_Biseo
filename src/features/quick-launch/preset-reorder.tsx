'use client';
import { useRef, useState } from 'react';
import type { PresetSummary } from '@/contracts/quick-launch';
import { usePresetMutation } from '@/lib/query/quick-launch';
import { presetErrorMessage } from '@/lib/api/quick-launch';
import { Button } from '@/components/ui/button';
import { ReorderControls } from '@/components/common/reorder-controls';

export function PresetReorder({
  initial,
  current,
  onClose,
}: {
  initial: PresetSummary[];
  current: PresetSummary[];
  onClose: () => void;
}) {
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState('');
  const mutation = usePresetMutation(),
    lock = useRef(false);
  const ids = draft.map((item) => item.id);
  const changed = ids.some((id, index) => id !== baseline[index]?.id);
  const sameMembers =
    current.length === ids.length &&
    new Set(ids).size === ids.length &&
    current.every((item) => ids.includes(item.id));
  function move(index: number, offset: number) {
    if (lock.current) return;
    const next = [...draft],
      item = next[index],
      other = next[index + offset];
    if (!item || !other) return;
    next[index] = other;
    next[index + offset] = item;
    setDraft(next);
    setMessage(`${item.name}, ${index + offset + 1}번째로 이동했어요.`);
  }
  async function save() {
    if (lock.current || !sameMembers) return;
    if (!changed) {
      onClose();
      return;
    }
    lock.current = true;
    try {
      await mutation.mutateAsync({ type: 'reorder', ids });
      onClose();
    } catch {
      /* Keep the draft; the existing mutation exposes the domain error. */
    } finally {
      lock.current = false;
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        위아래 버튼으로 표시 순서를 변경하세요.
      </p>
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          취소
        </Button>
        <Button
          loading={mutation.isPending}
          disabled={!sameMembers}
          onClick={() => void save()}
        >
          완료
        </Button>
      </div>
      {!sameMembers && (
        <div className="space-y-2">
          <p role="alert">
            빠른 실행 목록이 변경됐어요. 최신 목록을 확인하고 순서를 다시 정해
            주세요.
          </p>
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => {
              setBaseline(current);
              setDraft(current);
              mutation.reset();
              setMessage('최신 순서로 다시 시작했어요.');
            }}
          >
            최신 순서로 다시 시작
          </Button>
        </div>
      )}
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {presetErrorMessage(mutation.error)}
        </p>
      )}
      <ol
        aria-label="빠른 실행 순서 변경"
        className="divide-y rounded-lg border bg-surface"
      >
        {draft.map((item, index) => (
          <li key={item.id} className="flex min-w-0 items-center gap-3 p-3">
            <span className="w-8 shrink-0 text-center text-meta tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <span
              title={item.name}
              className="min-w-0 flex-1 truncate text-list font-medium"
            >
              {item.name}
            </span>
            <ReorderControls
              itemLabel={item.name}
              canMoveUp={index > 0}
              canMoveDown={index < draft.length - 1}
              disabled={mutation.isPending}
              onMoveUp={() => move(index, -1)}
              onMoveDown={() => move(index, 1)}
            />
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  );
}
