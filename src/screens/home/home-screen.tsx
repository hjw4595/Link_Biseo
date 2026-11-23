'use client';
import { useRef, useState } from 'react';
import { HomeOrganization } from '@/screens/home/organization/home-organization';
import { LinkDetailSheet } from '@/features/links/components/link-detail';
import { LinkRegistrationLink } from '@/features/links/components/link-registration';
import { Plus } from 'lucide-react';
import { TopBar } from '@/components/common/top-bar';
import { Button } from '@/components/ui/button';
import { FavoriteLinksSection } from '@/screens/home/favorites/favorite-links-section';
import { QuickLaunch } from '@/features/quick-launch/quick-launch';

export function HomeScreen() {
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
        <FavoriteLinksSection onDetail={showDetail} />
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
