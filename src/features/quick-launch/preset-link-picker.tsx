'use client';
import { ContentSkeleton } from '@/components/common/content-skeleton';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequestError } from '@/components/common/request-error';
import { useCategories, useLinks } from '@/lib/query/product';
import { linkErrorMessage } from '@/lib/api/links';
import type { LinkResponse } from '@/contracts/links';
import { AppSheetContent, AppSheetFooter } from '@/components/common/app-sheet';

export function PresetLinkPicker({
  selected,
  legacy,
  add,
  back,
}: {
  selected: LinkResponse[];
  legacy: boolean;
  add: (link: LinkResponse) => void;
  back: () => void;
}) {
  const [q, setQ] = useState(''),
    [query, setQuery] = useState(''),
    [categoryId, setCategory] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const links = useLinks({
    q: query || undefined,
    categoryId: categoryId || undefined,
    limit: 20,
  });
  const categories = useCategories();
  const rows = [
    ...new Map(
      (links.data?.pages.flatMap((p) => p.items) ?? []).map((l) => [l.id, l]),
    ).values(),
  ];
  const waiting = q.trim() !== query;
  const count =
    selected.length > 8
      ? `현재 ${selected.length}개 · 신규 최대 8개`
      : `${selected.length}/8`;
  return (
    <>
      <AppSheetContent>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={back}>
            ← 링크 추가
          </Button>
          <span aria-live="polite" className="text-meta">
            {count}
          </span>
        </div>
        <p className="mb-4 text-meta text-muted-foreground">
          내 링크에 저장된 항목을 선택하세요.
        </p>
        <Input
          type="search"
          aria-label="포함할 링크 검색"
          placeholder="링크 이름 또는 주소 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="my-3 flex items-center justify-between gap-3">
          <h3 className="shrink-0 font-semibold">등록된 링크</h3>
          <label className="min-w-0">
            <span className="sr-only">카테고리 필터</span>
            <select
              className="field-control max-w-full"
              value={categoryId}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">전체</option>
              <option value="uncategorized">미분류</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {categories.error && (
          <RequestError
            text="카테고리를 불러오지 못했어요."
            retry={() => void categories.refetch()}
          />
        )}
        {(selected.length >= 8 || legacy) && (
          <p role="status" className="mb-3 text-meta">
            {legacy
              ? '기존 빠른 실행에는 새 링크를 추가할 수 없어요. 8개 이하로 줄여 먼저 저장해 주세요.'
              : '최대 8개까지 추가할 수 있어요. 다른 링크를 추가하려면 편집에서 기존 링크를 제거해 주세요.'}
          </p>
        )}
        {waiting || links.isPending ? (
          <ContentSkeleton text="링크를 불러오고 있어요." compact />
        ) : links.error ? (
          <RequestError
            text={linkErrorMessage(links.error)}
            retry={() => void links.refetch()}
          />
        ) : (
          <>
            {!rows.length && (
              <p>
                {query || categoryId
                  ? '조건에 맞는 링크가 없어요.'
                  : '등록된 링크가 없어요. 내 링크에서 먼저 링크를 등록해 주세요.'}
              </p>
            )}
            <ul className="divide-y" aria-label="등록된 링크 선택">
              {rows.map((link) => {
                const included = selected.some((l) => l.id === link.id);
                return (
                  <li
                    key={link.id}
                    className="flex min-w-0 items-center gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 [overflow-wrap:anywhere]">
                        {link.title}
                      </p>
                      <p className="truncate text-meta text-muted-foreground">
                        {link.domain} ·{' '}
                        {categories.data?.find((c) => c.id === link.categoryId)
                          ?.name ??
                          (link.categoryId ? '카테고리 확인 중' : '미분류')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      aria-label={`${link.title} ${included ? '추가됨' : '추가'}`}
                      disabled={included || selected.length >= 8 || legacy}
                      onClick={() => add(link)}
                    >
                      {included ? '✓ 추가됨' : '+ 추가'}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {links.hasNextPage && (
              <Button
                variant="secondary"
                loading={links.isFetching}
                onClick={() => void links.fetchNextPage()}
              >
                더 보기
              </Button>
            )}
          </>
        )}
      </AppSheetContent>
      <AppSheetFooter>
        <Button className="w-full" onClick={back}>
          선택 완료 · {count}
        </Button>
      </AppSheetFooter>
    </>
  );
}
