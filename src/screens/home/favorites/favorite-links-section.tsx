'use client';
import Link from 'next/link';
import { SectionHeader } from '@/components/common/section-header';
import { RequestError } from '@/components/common/request-error';
import { Button } from '@/components/ui/button';
import { useCategories } from '@/features/categories/query/queries';
import { useLinks, useLinkMutation } from '@/features/links/query/queries';
import { linkView } from '@/features/links/types';
import { linkErrorMessage } from '@/features/links/errors';
import { useLinkOpen } from '@/features/links/use-link-open';
import { LinkList } from '@/features/links/components/link-list';
import { LinkListSkeleton } from '@/features/links/components/link-skeleton';
import { LinkOpenFeedback } from '@/features/links/components/link-open-feedback';

export function FavoriteLinksSection({
  onDetail,
}: {
  onDetail: (id: string, opener: HTMLButtonElement) => void;
}) {
  const categories = useCategories();
  const links = useLinks({ favorite: true, sort: 'default', limit: 6 });
  const mutation = useLinkMutation();
  const opening = useLinkOpen();
  return (
    <section className="space-y-3" aria-labelledby="favorites-heading">
      <SectionHeader
        id="favorites-heading"
        title="즐겨찾기"
        action={
          <Link
            href="/links?favorite=true"
            className="flex min-h-11 items-center text-meta text-muted-foreground hover:text-accent"
          >
            전체보기
          </Link>
        }
      />
      {links.isPending ? (
        <LinkListSkeleton
          compact
          count={6}
          grid
          text="즐겨찾기를 불러오고 있어요."
        />
      ) : links.error && !links.data ? (
        <RequestError
          text={linkErrorMessage(links.error)}
          retry={() => {
            void links.refetch();
          }}
        />
      ) : (
        <LinkList
          onDetail={onDetail}
          compact
          grid
          home
          emptyTitle="즐겨찾기한 링크가 없어요."
          emptyDescription="자주 여는 링크에 별을 표시해 보세요."
          emptyAction={
            <Button asChild variant="secondary">
              <Link href="/links">전체 링크 보기</Link>
            </Button>
          }
          onOpen={opening.activate}
          feedbackId={opening.state?.link.id}
          openFeedback={<LinkOpenFeedback opening={opening} />}
          openingId={opening.state?.pending ? opening.state.link.id : undefined}
          managementCategories={categories.data ?? []}
          categoryStatus={categories.status}
          links={(links.data?.pages[0]?.items ?? []).slice(0, 6).map(linkView)}
          busy={mutation.isPending}
          onFavorite={async (link) => {
            if (!mutation.isPending)
              await mutation.mutateAsync({
                type: 'save',
                id: link.id,
                input: { isFavorite: !link.favorite },
              });
          }}
        />
      )}
      {links.error && links.data && (
        <RequestError
          text={linkErrorMessage(links.error)}
          retry={() => {
            void links.refetch();
          }}
        />
      )}
      {mutation.error && (
        <p role="alert" className="text-destructive">
          {linkErrorMessage(mutation.error)}
        </p>
      )}
    </section>
  );
}
