'use client';
import { useLayoutEffect, useRef } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ReorderControls({
  itemLabel,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  disabled = false,
}: {
  itemLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
}) {
  const up = useRef<HTMLButtonElement>(null),
    down = useRef<HTMLButtonElement>(null);
  const moved = useRef<'up' | 'down' | null>(null);
  useLayoutEffect(() => {
    if (!moved.current || disabled) return;
    const target =
      moved.current === 'up'
        ? canMoveUp
          ? up
          : down
        : canMoveDown
          ? down
          : up;
    target.current?.focus();
    moved.current = null;
  });
  return (
    <div className="flex shrink-0 gap-2">
      <Button
        ref={up}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${itemLabel} 위로 이동`}
        title="위로 이동"
        disabled={disabled || !canMoveUp}
        onClick={() => {
          moved.current = 'up';
          onMoveUp();
        }}
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </Button>
      <Button
        ref={down}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${itemLabel} 아래로 이동`}
        title="아래로 이동"
        disabled={disabled || !canMoveDown}
        onClick={() => {
          moved.current = 'down';
          onMoveDown();
        }}
      >
        <ArrowDown className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
