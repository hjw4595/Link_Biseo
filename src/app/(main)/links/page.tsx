'use client';
import { LinkRegistrationLink } from '@/features/links/components/link-registration';
import Link from 'next/link';
import { FileUp, MoreHorizontal, Plus } from 'lucide-react';
import { TopBar } from '@/components/common/top-bar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { LinkBrowser } from '@/features/links/components/link-browser';
import { useCategories, useCategorySummary } from '@/lib/query/product';
import { RequestError } from '@/components/common/request-error';
import { useLinkFilters } from '@/features/links/use-link-filters';
import { isUuid } from '@/contracts/links';

export default function LinksPage() {
  const controls = useLinkFilters();
  const categories = useCategories();
  const summary = useCategorySummary();
  const categoryId = controls.filters.categoryId;
  // Preserve a pending UUID for the registration form's existing ownership check.
  // Missing category data is not the same state as an explicit uncategorized filter.
  const createHref =
    categoryId && (isUuid(categoryId) || categoryId === 'uncategorized')
      ? `/links/new?categoryId=${encodeURIComponent(categoryId)}&from=links`
      : '/links/new';
  return (
    <>
      <TopBar
        title="내 링크"
        heading
        description={
          summary.data ? (
            <p className="text-meta text-muted-foreground">
              전체 링크 {summary.data.totalLinkCount}개
            </p>
          ) : summary.isPending ? (
            <p role="status" className="text-meta text-muted-foreground">
              전체 링크 수 확인 중
            </p>
          ) : null
        }
        action={
          <>
            <div className="flex items-center gap-1 lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="내 링크 더보기"
                  >
                    <MoreHorizontal aria-hidden="true" className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/links/import">
                      <FileUp className="size-4" aria-hidden="true" />
                      북마크 가져오기
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button asChild size="sm">
                <LinkRegistrationLink href={createHref} aria-label="링크 등록">
                  <Plus aria-hidden="true" className="size-4" />
                  등록
                </LinkRegistrationLink>
              </Button>
            </div>
            <div
              role="group"
              aria-label="링크 작업"
              className="hidden gap-2 lg:flex"
            >
              <Button asChild variant="secondary">
                <Link href="/links/import">
                  <FileUp className="size-4" aria-hidden="true" />
                  북마크 가져오기
                </Link>
              </Button>
              <Button asChild>
                <LinkRegistrationLink href={createHref}>
                  <Plus aria-hidden="true" className="size-4" />
                  링크 등록
                </LinkRegistrationLink>
              </Button>
            </div>
          </>
        }
      />
      <div className="screen-content gap-5">
        {summary.error && (
          <RequestError
            text="전체 링크 수를 불러오지 못했어요."
            retry={() => {
              void summary.refetch();
            }}
          />
        )}
        {categories.error && (
          <RequestError
            text="카테고리 정보를 불러오지 못했어요. 링크는 계속 사용할 수 있어요."
            retry={() => {
              void categories.refetch();
            }}
          />
        )}
        <LinkBrowser
          controls={controls}
          managementCategories={categories.data ?? []}
          categoryStatus={categories.status}
          emptyAction={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <LinkRegistrationLink href={createHref}>
                  <Plus aria-hidden="true" className="size-4" />
                  링크 등록
                </LinkRegistrationLink>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/links/import">
                  <FileUp className="size-4" aria-hidden="true" />
                  북마크 가져오기
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    </>
  );
}
