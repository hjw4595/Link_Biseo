'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BottomNavigation } from './bottom-navigation';
import { NavigationGuardProvider } from './navigation-guard';
import { layoutProfile, profileClasses } from './app-layout-policy';
import { LinkSaveNotice } from '@/features/links/components/link-save-notice';

export function AppShell({
  children,
  navigation = true,
}: {
  children: ReactNode;
  navigation?: boolean;
}) {
  const pathname = usePathname();
  const profile = layoutProfile(pathname);
  return (
    <NavigationGuardProvider>
      <LinkSaveNotice />
      <div
        data-layout-profile={profile}
        className={`mx-auto min-h-dvh w-full bg-background ${profileClasses[profile]}`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:block focus:p-4 focus:text-accent"
        >
          본문으로 건너뛰기
        </a>
        {navigation && <BottomNavigation profile={profile} />}
        <main
          id="main-content"
          className={
            navigation
              ? 'pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0'
              : 'pb-[env(safe-area-inset-bottom)]'
          }
        >
          {children}
        </main>
      </div>
    </NavigationGuardProvider>
  );
}
