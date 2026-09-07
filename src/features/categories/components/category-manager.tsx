'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import type { CategoryResponse } from '@/contracts';
import {
  useCategories,
  useCategoryMutation,
  useCategorySummary,
} from '@/lib/query/product';
import { categoryErrorMessage } from '@/lib/api/categories';
import { TopBar } from '@/components/common/top-bar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { RequestError } from '@/components/common/request-error';
import { CategoryListSkeleton } from './category-skeleton';
import { CategoryEditor } from './category-editor';
import { CategoryReorder } from './category-reorder';

export function CategoryManager() {
  const query = useCategories();
  const counts = useCategorySummary(query.data !== undefined);
  const mutation = useCategoryMutation();
  const categories = query.data ?? [];
  const createRequested = useSearchParams().get('action') === 'create';
  const [intentHandled, setIntentHandled] = useState(false);
  const [editor, setEditor] = useState<{ category?: CategoryResponse } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<CategoryResponse | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const removed = useRef(false);
  if (createRequested && !intentHandled) {
    setIntentHandled(true);
    setEditor({});
  }
  useEffect(() => {
    if (!createRequested) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    window.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [createRequested]);
  function add() {
    returnFocusRef.current = addButton.current;
    setEditor({});
  }
  function countText(count: number | undefined) {
    return count !== undefined
      ? `링크 ${count}개`
      : counts.isError
        ? '링크 수 확인 불가'
        : '링크 수 확인 중';
  }
  return (
    <>
      <TopBar
        title="카테고리"
        heading
        action={
          <Button
            ref={addButton}
            variant="secondary"
            disabled={ordering || mutation.isPending}
            onClick={add}
          >
            <Plus className="size-4" aria-hidden="true" />
            카테고리 추가
          </Button>
        }
      />
      <div className="screen-content">
        <p className="text-meta text-muted-foreground">
          {query.data
            ? `${categories.length}개 카테고리`
            : query.isError
              ? '카테고리 목록을 확인하지 못했어요.'
              : '카테고리 목록을 확인하고 있어요.'}
        </p>
        {query.error && (
          <RequestError
            text={categoryErrorMessage(query.error)}
            retry={() => {
              void query.refetch();
            }}
          />
        )}
        {counts.error && (
          <RequestError
            text="링크 수를 불러오지 못했어요."
            retry={() => {
              void counts.refetch();
            }}
          />
        )}
        {query.isPending ? (
          <CategoryListSkeleton text="카테고리를 불러오고 있어요." />
        ) : ordering ? (
          <CategoryReorder
            categories={categories}
            reload={query.refetch}
            onClose={() => {
              setOrdering(false);
              requestAnimationFrame(() =>
                document.getElementById('category-reorder-trigger')?.focus(),
              );
            }}
          />
        ) : (
          <section className="space-y-3" aria-labelledby="my-categories-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="my-categories-title" className="font-semibold">
                내 카테고리
              </h2>
              <Button
                id="category-reorder-trigger"
                variant="ghost"
                disabled={!query.isSuccess || categories.length < 2}
                onClick={() => setOrdering(true)}
              >
                순서 변경
              </Button>
            </div>
            {categories.length ? (
              <ul
                aria-label="저장된 카테고리"
                className="grid grid-cols-1 gap-3 lg:grid-cols-2"
              >
                {categories.map((category) => (
                  <li
                    key={category.id}
                    className="flex min-w-0 items-center rounded-lg border bg-surface"
                  >
                    <Link
                      href={`/links?categoryId=${encodeURIComponent(category.id)}`}
                      aria-label={`${category.name} 링크 보기`}
                      className="flex min-w-0 flex-1 self-stretch items-center gap-3 rounded-lg p-4 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <Folder
                        aria-hidden="true"
                        className="size-5 shrink-0 text-muted-foreground"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="block text-list font-medium [overflow-wrap:anywhere]">
                          {category.name}
                        </span>
                        <span className="block text-meta text-muted-foreground">
                          {countText(
                            counts.data?.items.find(
                              (item) => item.id === category.id,
                            )?.linkCount,
                          )}
                        </span>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    </Link>
                    <CategoryMenu
                      category={category}
                      returnFocusRef={returnFocusRef}
                      pendingActionRef={pendingActionRef}
                      onRename={() => setEditor({ category })}
                      onDelete={() => {
                        setDeleteError(null);
                        removed.current = false;
                        setDeleting(category);
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              query.isSuccess && (
                <EmptyState
                  title="아직 카테고리가 없어요."
                  description="카테고리를 추가해 링크를 분류해 보세요."
                  action={
                    <Button variant="secondary" onClick={add}>
                      첫 카테고리 추가
                    </Button>
                  }
                />
              )
            )}
          </section>
        )}
        <Link
          href="/links?categoryId=uncategorized"
          aria-label="미분류 링크 보기"
          className="flex min-w-0 items-center gap-3 border-t py-5 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <FolderOpen
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 flex-1 font-medium">미분류</span>
          <span className="text-meta text-muted-foreground">
            {countText(counts.data?.uncategorizedCount)}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </Link>
      </div>
      {editor && (
        <CategoryEditor
          category={editor.category}
          categories={categories}
          ready={query.data !== undefined}
          onClose={() => setEditor(null)}
          returnFocus={returnFocusRef}
          fallbackFocus={addButton}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`'${deleting?.name ?? ''}' 카테고리를 삭제할까요?`}
        description="카테고리만 삭제되며, 포함된 링크는 미분류로 이동해요."
        confirmLabel="카테고리 삭제"
        variant="destructive"
        pending={mutation.isPending}
        error={deleteError}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          (removed.current || !returnFocusRef.current?.isConnected
            ? addButton.current
            : returnFocusRef.current
          )?.focus();
        }}
        onConfirm={async () => {
          if (!deleting) return false;
          setDeleteError(null);
          try {
            await mutation.mutateAsync({ type: 'delete', id: deleting.id });
            removed.current = true;
            return true;
          } catch (reason: unknown) {
            setDeleteError(categoryErrorMessage(reason));
            return false;
          }
        }}
      />
    </>
  );
}

function CategoryMenu({
  category,
  returnFocusRef,
  pendingActionRef,
  onRename,
  onDelete,
}: {
  category: CategoryResponse;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  pendingActionRef: React.RefObject<(() => void) | null>;
  onRename: () => void;
  onDelete: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) returnFocusRef.current = triggerRef.current;
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 shrink-0"
          aria-label={`${category.name} 관리`}
          ref={triggerRef}
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (!pendingActionRef.current) return;
          event.preventDefault();
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          requestAnimationFrame(action);
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            pendingActionRef.current = onRename;
          }}
        >
          이름 변경
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onSelect={() => {
            pendingActionRef.current = onDelete;
          }}
        >
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
