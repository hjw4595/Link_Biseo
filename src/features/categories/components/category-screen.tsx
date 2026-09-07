'use client';
import { LinkRegistrationLink } from '@/features/links/components/link-registration';
import { Plus } from 'lucide-react';
import { TopBar } from '@/components/common/top-bar';
import { Button } from '@/components/ui/button';
import { useCategories } from '@/lib/query/product';
import { PageLoading } from '@/components/common/page-loading';
import { RequestError } from '@/components/common/request-error';
import { LinkBrowser } from '@/features/links/components/link-browser';
import { MissingResource } from '@/components/common/missing-resource';

export function CategoryScreen({ id }: { id: string }) {
  const query = useCategories();
  if (query.isPending)
    return <PageLoading text="카테고리를 불러오고 있어요." />;
  if (query.error)
    return (
      <div className="screen-content">
        <RequestError
          text="카테고리를 불러오지 못했어요."
          retry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  const categories = query.data ?? [];
  const category = categories.find((item) => item.id === id);
  if (!category) return <MissingResource kind="카테고리" />;
  return (
    <>
      <TopBar
        title="카테고리"
        backHref="/categories"
        action={
          <Button asChild variant="ghost" size="icon">
            <LinkRegistrationLink
              href={`/links/new?categoryId=${encodeURIComponent(id)}`}
              aria-label="링크 추가"
            >
              <Plus aria-hidden="true" />
            </LinkRegistrationLink>
          </Button>
        }
      />
      <div className="screen-content gap-6">
        <div className="space-y-2">
          <h1 className="break-words text-hero font-semibold">
            {category.name}
          </h1>
          <p className="text-muted-foreground">저장한 링크</p>
        </div>
        <LinkBrowser
          categoryId={id}
          managementCategories={categories}
          emptyAction={
            <Button asChild variant="secondary">
              <LinkRegistrationLink
                href={`/links/new?categoryId=${encodeURIComponent(id)}`}
              >
                링크 추가하기
              </LinkRegistrationLink>
            </Button>
          }
        />
      </div>
    </>
  );
}
