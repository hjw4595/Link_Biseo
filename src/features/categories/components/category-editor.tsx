'use client';
import { useRef, useState, type RefObject } from 'react';
import type { CategoryResponse } from '@/contracts';
import {
  AppSheet,
  AppSheetHeader,
  AppSheetContent,
  AppSheetFooter,
} from '@/components/common/app-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCategoryMutation } from '@/lib/query/product';
import { categoryErrorMessage } from '@/lib/api/categories';
import { categoryNameKey } from '../setup';

export function CategoryEditor({
  category,
  categories,
  ready,
  onClose,
  returnFocus,
  fallbackFocus,
}: {
  category?: CategoryResponse;
  categories: readonly CategoryResponse[];
  ready: boolean;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  fallbackFocus: RefObject<HTMLElement | null>;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const mutation = useCategoryMutation();
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();
  const duplicate = categories.some(
    (row) =>
      row.id !== category?.id &&
      categoryNameKey(row.name) === categoryNameKey(trimmed),
  );
  const valid =
    trimmed.length > 0 &&
    [...trimmed].length <= 100 &&
    !trimmed.includes('\0') &&
    !duplicate;
  const unchanged = category?.name === trimmed;
  const nextOrder = Math.max(-1, ...categories.map((row) => row.sortOrder)) + 1;
  const orderOverflow = !category && nextOrder > 2147483647;
  const validation = duplicate
    ? '같은 이름의 카테고리가 있어요. 다른 이름을 입력해 주세요.'
    : [...trimmed].length > 100 || trimmed.includes('\0')
      ? '이름은 1~100자로 입력해 주세요.'
      : null;
  async function submit() {
    if (!ready || !valid || unchanged || orderOverflow || pending.current)
      return;
    pending.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({
        type: 'save',
        id: category?.id,
        input: category
          ? { name: trimmed }
          : { name: trimmed, sortOrder: nextOrder },
      });
      onClose();
    } catch (reason: unknown) {
      setError(categoryErrorMessage(reason));
    } finally {
      pending.current = false;
    }
  }
  return (
    <AppSheet
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
      busy={mutation.isPending}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        input.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        (returnFocus.current?.isConnected
          ? returnFocus.current
          : fallbackFocus.current
        )?.focus();
      }}
    >
      <AppSheetHeader title={category ? '이름 변경' : '카테고리 추가'} />
      <AppSheetContent>
        <form
          id="category-editor"
          className="space-y-3 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="category-name" className="text-sm font-medium">
            카테고리 이름
          </label>
          <Input
            ref={input}
            id="category-name"
            autoComplete="off"
            value={name}
            disabled={mutation.isPending}
            aria-invalid={Boolean(validation || error)}
            aria-describedby="category-name-help"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          <p
            id="category-name-help"
            className={
              validation || error || orderOverflow
                ? 'text-sm text-destructive'
                : 'text-meta text-muted-foreground'
            }
            role={validation || error || orderOverflow ? 'alert' : undefined}
          >
            {validation ||
              error ||
              (orderOverflow
                ? '순서 변경을 완료한 뒤 카테고리를 추가해 주세요.'
                : '1~100자로 입력해 주세요.')}
          </p>
          {!ready && (
            <p role="status" className="text-sm text-muted-foreground">
              카테고리 목록을 확인한 뒤 추가할 수 있어요.
            </p>
          )}
        </form>
      </AppSheetContent>
      <AppSheetFooter>
        <Button
          variant="secondary"
          disabled={mutation.isPending}
          onClick={() => {
            if (!pending.current) onClose();
          }}
        >
          취소
        </Button>
        <Button
          type="submit"
          form="category-editor"
          loading={mutation.isPending}
          disabled={!ready || !valid || unchanged || orderOverflow}
        >
          {category ? '변경 저장' : '추가'}
        </Button>
      </AppSheetFooter>
    </AppSheet>
  );
}
