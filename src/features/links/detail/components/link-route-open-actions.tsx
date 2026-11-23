'use client';
import { ArrowUpRight } from 'lucide-react';
import type { LinkResponse } from '@/contracts/links';
import { buttonVariants } from '@/components/ui/button';
import { ExternalLink } from '../../components/external-link';
import { LinkOpenFeedback } from '../../components/link-open-feedback';
import { useLinkOpen } from '../../use-link-open';
import { linkView } from '../../types';

// Direct bookmarks retain the existing explicit open controls; the list Sheet has none.
export function LinkRouteOpenActions({ response }: { response: LinkResponse }) {
  const opening = useLinkOpen();
  const link = linkView(response);
  return (
    <>
      <ExternalLink
        link={link}
        label="링크 열기"
        onActivate={opening.activate}
        busy={opening.state?.pending}
        className={buttonVariants()}
      >
        링크 열기 <ArrowUpRight aria-hidden="true" className="size-4" />
      </ExternalLink>
      <ExternalLink
        link={link}
        label="새 탭에서 열기"
        newTab
        onActivate={opening.activate}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        새 탭에서 열기 <ArrowUpRight aria-hidden="true" className="size-4" />
      </ExternalLink>
      <LinkOpenFeedback opening={opening} />
    </>
  );
}
