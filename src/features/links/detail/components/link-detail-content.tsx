'use client';
import type { RefObject } from 'react';
import { Copy } from 'lucide-react';
import type { LinkResponse } from '@/contracts/links';
import { CategorySelect } from '@/features/categories/components/category-select';
import type { useCategories } from '@/features/categories/query/queries';
import type { useLinkStats } from '../../query/queries';
import type { useLinkEditor } from '../../components/link-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RequestError } from '@/components/common/request-error';
import { LinkFavicon } from '../../components/link-favicon';
import { LinkUsage } from '../../components/link-usage';
import { usageDateLabel } from '../../usage-date';
import { dateInZone } from '@/lib/time-zone';

export function LinkDetailContent({
  response,
  editor,
  nameInput,
  categories,
  stats,
  timeZone,
  today,
  busy,
  onCopy,
}: {
  response: LinkResponse;
  editor: ReturnType<typeof useLinkEditor>;
  nameInput: RefObject<HTMLInputElement | null>;
  categories: ReturnType<typeof useCategories>;
  stats: ReturnType<typeof useLinkStats>;
  timeZone: string;
  today: string | null;
  busy: boolean;
  onCopy: () => void;
}) {
  const draft = editor.draft;
  const category = categories.data?.find(
    (item) => item.id === response.categoryId,
  );
  return (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <LinkFavicon key={response.faviconUrl} src={response.faviconUrl} />
        <div className="min-w-0 flex-1 space-y-2">
          {draft ? (
            <div className="space-y-2">
              <label htmlFor="edit-title">제목</label>
              <Input
                ref={nameInput}
                id="edit-title"
                value={draft.title}
                maxLength={200}
                disabled={busy}
                onChange={(event) => editor.update('title', event.target.value)}
              />
            </div>
          ) : (
            <h1 className="break-words text-[26px] leading-snug font-semibold tracking-tight [overflow-wrap:anywhere]">
              {response.title}
            </h1>
          )}
          <p className="break-all text-sm text-muted-foreground">
            {response.domain}
          </p>
        </div>
      </div>
      <section className="space-y-2" aria-label="URL">
        <p
          className="select-all break-all text-sm leading-6 text-muted-foreground"
          aria-label="링크 URL"
        >
          {response.url}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
          <Copy aria-hidden="true" className="size-4" />
          URL 복사
        </Button>
      </section>
      <div className="space-y-2">
        {draft ? (
          <>
            <label htmlFor="edit-category">카테고리</label>
            <CategorySelect
              id="edit-category"
              categories={categories.data ?? []}
              retainedOption={
                draft.initial.categoryId
                  ? { id: draft.initial.categoryId, label: '현재 카테고리' }
                  : undefined
              }
              value={draft.category}
              disabled={busy || categories.status !== 'success'}
              onChange={(event) =>
                editor.update('category', event.target.value)
              }
            />
          </>
        ) : (
          <>
            <p className="text-meta text-muted-foreground">카테고리</p>
            <p className="break-words">
              {category?.name ??
                (response.categoryId
                  ? categories.isError
                    ? '카테고리 조회 실패'
                    : '카테고리 확인 중'
                  : '미분류')}
            </p>
          </>
        )}
        {categories.isPending && (
          <p role="status" className="text-meta text-muted-foreground">
            카테고리를 불러오고 있어요.
          </p>
        )}
        {categories.error && (
          <RequestError
            text="카테고리를 확인하지 못했어요."
            retry={() => {
              void categories.refetch();
            }}
          />
        )}
      </div>
      {draft ? (
        <div className="space-y-2">
          <label htmlFor="edit-description">설명</label>
          <Textarea
            id="edit-description"
            value={draft.description}
            maxLength={2000}
            disabled={busy}
            onChange={(event) =>
              editor.update('description', event.target.value)
            }
          />
        </div>
      ) : (
        response.description && (
          <p className="whitespace-pre-wrap break-words leading-6 text-muted-foreground [overflow-wrap:anywhere]">
            {response.description}
          </p>
        )
      )}
      <dl className="space-y-4 border-y py-5 leading-6">
        <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
          <dt className="text-muted-foreground">등록일</dt>
          <dd>
            {dateInZone(
              stats.data?.createdAt ?? response.createdAt,
              timeZone,
            ).replaceAll('-', '.')}
          </dd>
        </div>
        <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
          <dt className="text-muted-foreground">최근 사용</dt>
          <dd>
            {usageDateLabel(
              stats.isSuccess && stats.data.periodEndDate === today
                ? stats.data.lastOpenedAt
                : response.lastOpenedAt,
              today,
              timeZone,
            )}
          </dd>
        </div>
      </dl>
      <LinkUsage stats={stats} today={today} />
    </>
  );
}
