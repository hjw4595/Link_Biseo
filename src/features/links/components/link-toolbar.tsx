'use client';
import { Star, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';
import { isLinkSort, type LinkFilterControls } from '../use-link-filters';

export function LinkToolbar({
  controls,
  categories,
  status,
}: {
  controls: LinkFilterControls;
  categories: readonly { id: string; name: string }[];
  status: 'pending' | 'success' | 'error';
}) {
  const input = useRef<HTMLInputElement>(null);
  const { filters, change, reset, active } = controls;
  const missing =
    filters.categoryId &&
    filters.categoryId !== 'uncategorized' &&
    !categories.some((row) => row.id === filters.categoryId);
  return (
    <div className="space-y-3 border-b pb-4">
      <div className="relative">
        <Input
          ref={input}
          type="search"
          aria-label="저장한 링크 검색"
          placeholder="제목 또는 주소 검색"
          className="pr-12 [&::-webkit-search-cancel-button]:appearance-none"
          value={filters.q}
          onChange={(event) => change({ q: event.target.value })}
        />
        {filters.q && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0.5 right-0.5"
            aria-label="검색어 지우기"
            onClick={() => {
              change({ q: '' });
              input.current?.focus();
            }}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
      <div
        className="flex min-w-0 flex-wrap items-center gap-2"
        role="group"
        aria-label="링크 필터"
      >
        <label htmlFor="link-category-filter" className="sr-only">
          카테고리 필터
        </label>
        <select
          id="link-category-filter"
          className="h-11 min-w-0 flex-1 basis-36 rounded-md border bg-background px-3 text-sm sm:max-w-64 lg:flex-none lg:basis-64"
          value={filters.categoryId ?? ''}
          onChange={(event) =>
            change({ categoryId: event.target.value || undefined })
          }
        >
          <option value="">모든 카테고리</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value="uncategorized">미분류</option>
          {missing && (
            <option value={filters.categoryId}>
              {status === 'success'
                ? '삭제되었거나 사용할 수 없는 카테고리'
                : '카테고리 확인 중'}
            </option>
          )}
        </select>
        <Button
          size="sm"
          variant={filters.favorite ? 'default' : 'secondary'}
          aria-pressed={filters.favorite}
          onClick={() => change({ favorite: !filters.favorite })}
        >
          <Star
            aria-hidden="true"
            className="size-4"
            fill={filters.favorite ? 'currentColor' : 'none'}
          />
          즐겨찾기
        </Button>
        <label htmlFor="link-order" className="sr-only">
          정렬
        </label>
        <select
          id="link-order"
          className="h-11 min-w-0 flex-1 basis-44 rounded-md border bg-background px-3 text-sm sm:flex-none sm:basis-auto lg:ml-auto lg:w-44"
          value={filters.sort}
          onChange={(event) => {
            if (isLinkSort(event.target.value))
              change({ sort: event.target.value });
          }}
        >
          <option value="default">즐겨찾기 우선</option>
          <option value="recent">최근 방문순</option>
          <option value="frequent">자주 방문한 순</option>
          <option value="smart">즐겨찾기·방문순</option>
        </select>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto lg:ml-0"
            onClick={reset}
          >
            초기화
          </Button>
        )}
      </div>
      {missing && status === 'success' && (
        <p role="alert" className="text-sm text-muted-foreground">
          사용할 수 없는 카테고리예요. 다른 카테고리를 선택해 주세요.
        </p>
      )}
    </div>
  );
}
