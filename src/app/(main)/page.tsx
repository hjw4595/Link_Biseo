'use client';
import { useRef, useState } from 'react';
import { HomeOrganization } from '@/features/organization/components/home-organization';
import { LinkDetailSheet } from '@/features/links/components/link-detail';
import { LinkRegistrationLink } from '@/features/links/components/link-registration';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TopBar } from '@/components/common/top-bar';
import { SectionHeader } from '@/components/common/section-header';
import { Button } from '@/components/ui/button';
import { LinkList } from '@/features/links/components/link-list';
import { useCategories, useLinks, useLinkMutation } from '@/lib/query/product';
import { linkView } from '@/features/links/types';
import { LinkListSkeleton } from '@/features/links/components/link-skeleton';
import { RequestError } from '@/components/common/request-error';
import { linkErrorMessage } from '@/lib/api/links';
import { useLinkOpen } from '@/features/links/use-link-open';
import { LinkOpenFeedback } from '@/features/links/components/link-open-feedback';
import { QuickLaunch } from '@/features/quick-launch/quick-launch';

export default function Home() {
  const categories = useCategories();
  const links = useLinks({ favorite: true, sort: 'default', limit: 6 });
  const mutation = useLinkMutation();
  const opening = useLinkOpen();
  const [detail, setDetail] = useState<string | null>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const detailSection = useRef<HTMLElement | null>(null);
  function showDetail(id: string, opener: HTMLButtonElement) {
    detailTrigger.current = opener;
    detailSection.current = opener.closest<HTMLElement>('section');
    setDetail(id);
  }
  return (
    <>
      <TopBar
        title="홈"
        action={
          <Button asChild variant="ghost" size="icon">
            <LinkRegistrationLink href="/links/new" aria-label="링크 추가">
              <Plus className="size-5" aria-hidden="true" />
            </LinkRegistrationLink>
          </Button>
        }
      />
      <div className="screen-content">
        <h1 id="home-title" tabIndex={-1} className="sr-only">
          링크비서 홈
        </h1>
        <QuickLaunch />
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
              onDetail={showDetail}
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
              openingId={
                opening.state?.pending ? opening.state.link.id : undefined
              }
              managementCategories={categories.data ?? []}
              categoryStatus={categories.status}
              links={(links.data?.pages[0]?.items ?? [])
                .slice(0, 6)
                .map(linkView)}
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
        <HomeOrganization onDetail={showDetail} />
      </div>
      {detail && (
        <LinkDetailSheet
          id={detail}
          onClose={() => setDetail(null)}
          returnFocus={() => {
            if (
              detailTrigger.current?.isConnected &&
              detailTrigger.current.getClientRects().length
            )
              return detailTrigger.current;
            // Keep focus in the originating section, including the empty favorites list.
            const section = detailSection.current;
            if (section?.isConnected)
              return (
                section.querySelector<HTMLElement>('[data-link-detail]') ??
                section.querySelector<HTMLElement>('[tabindex="-1"]') ??
                section.querySelector<HTMLElement>('h2 button') ??
                document.getElementById('home-title')
              );
            return document.getElementById('home-title');
          }}
        />
      )}
    </>
  );
}
