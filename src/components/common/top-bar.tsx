import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type TopBarProps = {
  title: string;
  brand?: boolean;
  backHref?: string;
  backAction?: ReactNode;
  heading?: boolean;
  action?: ReactNode;
  description?: ReactNode;
};
export function TopBar({
  title,
  brand = false,
  backHref,
  backAction,
  heading = false,
  action,
  description,
}: TopBarProps) {
  const Title = heading ? 'h1' : 'span';
  return (
    <header className="page-gutter flex min-h-16 items-center justify-between gap-3 pt-[env(safe-area-inset-top)]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {backAction}
        {backHref && (
          <Button asChild variant="ghost" size="icon">
            <Link href={backHref} aria-label="뒤로 가기">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
          </Button>
        )}
        {brand && (
          <Image
            src="/favicons/logo-mark.svg"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0"
          />
        )}
        {description ? (
          <div className="min-w-0 space-y-1">
            <Title className="truncate text-base font-semibold">{title}</Title>
            {description}
          </div>
        ) : (
          <Title className="truncate text-base font-semibold">{title}</Title>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center">{action}</div>}
    </header>
  );
}
