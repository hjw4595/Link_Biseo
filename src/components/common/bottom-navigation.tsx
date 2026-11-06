'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useNavigationGuard } from './navigation-guard';
import { House, Folder, Link2, Settings2 } from 'lucide-react';
import { profileClasses, type LayoutProfile } from './app-layout-policy';
import { LaunchToggle } from '@/features/link-launch/launch-toggle';

const destinations = [
  { href: '/', label: '홈', icon: House },
  { href: '/categories', label: '카테고리', icon: Folder },
  { href: '/links', label: '내 링크', icon: Link2 },
  { href: '/settings', label: '설정', icon: Settings2 },
];

// One menu/active state/guard at every size; only its CSS placement changes.
// Explicit tabIndex=0 keeps links in WebKit's keyboard navigation as well.
// The desktop bar fills the same responsive frame as every page body.
export function BottomNavigation({ profile }: { profile: LayoutProfile }) {
  const pathname = usePathname();
  const guard = useNavigationGuard();
  return (
    <nav
      aria-label="주요 메뉴"
      className={`bottom-safe fixed bottom-0 left-1/2 z-30 grid w-full -translate-x-1/2 grid-cols-4 border-t bg-background px-3 pt-2 lg:static lg:flex lg:h-16 lg:max-w-none lg:translate-x-0 lg:items-center lg:justify-between lg:gap-6 lg:border-t-0 lg:border-b lg:px-6 lg:py-0 ${profileClasses[profile]}`}
    >
      <Link
        href="/"
        tabIndex={0}
        aria-label="LINK BISEO 홈으로 이동"
        onNavigate={(event) => {
          if (!guard.allow()) event.preventDefault();
        }}
        className="hidden min-h-11 shrink-0 items-center gap-2 rounded-sm text-base font-semibold lg:flex"
      >
        <Image
          src="/favicons/logo-mark.svg"
          alt=""
          width={32}
          height={32}
          className="size-8"
        />
        <span>LINK BISEO</span>
      </Link>
      <div
        data-navigation-items
        className="contents lg:flex lg:items-center lg:gap-1"
      >
        {destinations.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/'
              ? pathname === '/'
              : href === '/categories'
                ? pathname === '/categories' ||
                  pathname.startsWith('/categories/') ||
                  pathname.startsWith('/category/')
                : pathname === href ||
                  pathname.startsWith(href + '/') ||
                  (href === '/links' && pathname === '/assistant/organization');
          return (
            <Link
              key={href}
              href={href}
              tabIndex={0}
              onNavigate={(event) => {
                if (!guard.allow()) event.preventDefault();
              }}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-sm text-meta font-medium lg:min-h-11 lg:flex-row lg:gap-2 lg:px-3 lg:text-sm ${active ? 'text-accent lg:bg-surface lg:font-semibold' : 'text-muted-foreground hover:text-foreground lg:hover:bg-surface'}`}
            >
              <Icon
                className="size-5 lg:size-[18px]"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>{label}</span>
            </Link>
          );
        })}
        <LaunchToggle />
      </div>
    </nav>
  );
}
