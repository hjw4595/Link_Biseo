'use client';
import { useRef, useState, type ReactNode } from 'react';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LinkListSkeleton } from '@/features/links/components/link-skeleton';
import { RequestError } from '@/components/common/request-error';
import { useLinks, useLinkMutation } from '@/lib/query/product';
import { linkErrorMessage } from '@/lib/api/links';
import type { LinkSort } from '@/contracts/links';
import { linkView, type LinkView } from '../types';
import { LinkList } from './link-list';
import { useLinkOpen } from '../use-link-open';
import { LinkOpenFeedback } from './link-open-feedback';
import type { LinkFilterControls } from '../use-link-filters';
import { LinkToolbar } from './link-toolbar';

export function LinkBrowser({
  categoryId,
  searchable = false,
  emptyAction,
  initialQuery = '',
  initialFavorite = false,
  managementCategories,
  categoryStatus,
  controls,
}: {
  categoryId?: string;
  searchable?: boolean;
  emptyAction?: ReactNode;
  initialQuery?: string;
  initialFavorite?: boolean;
  managementCategories?: readonly { id: string; name: string }[];
  categoryStatus?: 'pending' | 'success' | 'error';
  controls?: LinkFilterControls;
}) {
  const [filter, setFilter] = useState(initialFavorite ? 'favorites' : 'all');
  const [order, setOrder] = useState<LinkSort>('default');
  const [query, setQuery] = useState(initialQuery);
  const input = useRef<HTMLInputElement>(null);
  const current = controls?.filters ?? {
    q: query,
    categoryId: filter === 'uncategorized' ? 'uncategorized' : categoryId,
    favorite: filter === 'favorites',
    sort: order,
  };
  const filtered = Boolean(
    current.q.trim() || current.categoryId || current.favorite,
  );
  const data = useLinks({
    q: current.q.trim() || undefined,
    categoryId: current.categoryId,
    favorite: current.favorite ? true : undefined,
    sort: current.sort,
    limit: 20,
  });
  const mutation = useLinkMutation();
  const opening = useLinkOpen();
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const unique = [
    ...new Map(
      (data.data?.pages.flatMap((p) => p.items) ?? []).map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];
  const visible = unique.map(linkView);
  async function favorite(link: LinkView) {
    if (pending.current) return;
    pending.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({
        type: 'save',
        id: link.id,
        input: { isFavorite: !link.favorite },
      });
    } catch (reason) {
      setError(linkErrorMessage(reason));
    } finally {
      pending.current = false;
    }
  }
  const results = (
    <>
      {data.isPending ? (
        <LinkListSkeleton text="링크를 불러오고 있어요." />
      ) : (
        <>
          {data.error && (
            <RequestError
              text={linkErrorMessage(data.error)}
              retry={() => {
                void (data.isFetchNextPageError
                  ? data.fetchNextPage()
                  : data.refetch());
              }}
            />
          )}
          {(!data.error || data.data) && (
            <LinkList
              compact={Boolean(controls)}
              onOpen={opening.activate}
              feedbackId={opening.state?.link.id}
              openFeedback={<LinkOpenFeedback opening={opening} />}
              openingId={
                opening.state?.pending ? opening.state.link.id : undefined
              }
              links={visible}
              managementCategories={managementCategories}
              categoryStatus={categoryStatus}
              emptyTitle={
                current.q.trim()
                  ? '검색 결과가 없어요.'
                  : filtered
                    ? '조건에 맞는 링크가 없어요.'
                    : '아직 링크가 없어요'
              }
              emptyDescription={
                current.q.trim()
                  ? '다른 검색어로 찾아보세요.'
                  : filtered
                    ? '다른 조건으로 찾아보세요.'
                    : undefined
              }
              emptyAction={
                controls ? (
                  filtered ? (
                    <Button variant="secondary" onClick={controls.reset}>
                      필터 초기화
                    </Button>
                  ) : (
                    emptyAction
                  )
                ) : query.trim() ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('');
                      input.current?.focus();
                    }}
                  >
                    검색어 지우기
                  </Button>
                ) : filter !== 'all' ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilter('all');
                      setOrder('default');
                    }}
                  >
                    필터 초기화
                  </Button>
                ) : (
                  emptyAction
                )
              }
              onFavorite={favorite}
              busy={mutation.isPending}
            />
          )}
          {data.hasNextPage ? (
            <Button
              variant="secondary"
              loading={data.isFetching}
              onClick={() => {
                if (!data.isFetching) void data.fetchNextPage();
              }}
            >
              더 보기
            </Button>
          ) : (
            !controls &&
            unique.length > 0 && (
              <p className="text-meta text-muted-foreground">
                모든 링크를 불러왔어요.
              </p>
            )
          )}
        </>
      )}
    </>
  );
  return (
    <div className="space-y-4">
      {controls ? (
        <>
          <LinkToolbar
            controls={controls}
            categories={managementCategories ?? []}
            status={categoryStatus ?? 'pending'}
          />
          {results}
        </>
      ) : (
        <>
          {searchable && (
            <div className="space-y-2">
              <Input
                ref={input}
                type="search"
                aria-label="저장한 링크 검색"
                placeholder="제목, URL, 도메인으로 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <p className="text-meta text-muted-foreground">
                저장한 전체 링크의 제목, URL, 도메인을 검색해요.
              </p>
            </div>
          )}
          <FilterTabs
            toolbarEnd={
              <div className="flex items-center justify-end gap-2 text-meta text-muted-foreground">
                <label htmlFor="link-order">정렬</label>
                <select
                  id="link-order"
                  className="min-h-11 max-w-full rounded-sm bg-background px-2 text-sm text-foreground"
                  value={order}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (
                      value === 'default' ||
                      value === 'recent' ||
                      value === 'frequent' ||
                      value === 'smart'
                    )
                      setOrder(value);
                  }}
                >
                  <option value="default">즐겨찾기 우선</option>
                  <option value="recent">최근 방문순</option>
                  <option value="frequent">자주 방문한 순</option>
                  <option value="smart">즐겨찾기·방문순</option>
                </select>
              </div>
            }
            label="링크 필터"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: 'all', label: '전체' },
              { value: 'favorites', label: '즐겨찾기' },
              ...(!categoryId
                ? [{ value: 'uncategorized', label: '미분류' }]
                : []),
            ]}
          >
            {results}
          </FilterTabs>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
