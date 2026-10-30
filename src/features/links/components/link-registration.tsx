'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { useNavigationGuard } from '@/components/common/navigation-guard';
import { AddLinkForm } from './add-link-form';

interface Entry {
  categoryId: string;
  fromLinks: boolean;
  location: string;
  key: number;
}
const Context = createContext<
  ((href: string, opener: HTMLAnchorElement) => void) | null
>(null);

/** A single registration Sheet per authenticated screen, with no route change on entry. */
export function LinkRegistrationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const location = `${pathname}?${search}`;
  const [entry, setEntry] = useState<Entry | null>(null);
  const generation = useRef(0);
  const returnFocus = useRef<HTMLAnchorElement | null>(null);
  const guard = useNavigationGuard();
  // A permitted browser/navigation transition cannot leave a registration overlay behind.
  if (entry && entry.location !== location) setEntry(null);
  function open(href: string, opener: HTMLAnchorElement) {
    if (!guard.allow()) return;
    const url = new URL(href, window.location.href);
    returnFocus.current = opener;
    setEntry({
      categoryId: url.searchParams.get('categoryId') ?? '',
      fromLinks: url.searchParams.get('from') === 'links',
      location,
      key: ++generation.current,
    });
  }
  function registered(destination: string) {
    setEntry(null);
    // Preserve the original save destination and Back history while retaining the mounted list.
    if (
      pathname === '/links' &&
      new URL(destination, window.location.href).pathname === '/links'
    )
      window.history.pushState(null, '', destination);
    else router.push(destination);
  }
  return (
    <Context.Provider value={open}>
      {children}
      {entry && (
        <AddLinkForm
          key={entry.key}
          initialCategoryId={entry.categoryId}
          returnToLinks={entry.fromLinks}
          onClose={() => setEntry(null)}
          onRegistered={registered}
          returnFocus={returnFocus}
        />
      )}
    </Context.Provider>
  );
}

/** Keep href and native modified/new-tab navigation; intercept ordinary registration activation. */
export function LinkRegistrationLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const open = useContext(Context);
  return (
    <Link
      {...props}
      href={href}
      data-link-registration-trigger=""
      onClick={(event) => {
        onClick?.(event);
        if (
          !open ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey ||
          event.currentTarget.hasAttribute('download') ||
          (event.currentTarget.target &&
            event.currentTarget.target !== '_self') ||
          event.currentTarget.closest('[data-app-sheet]')
        )
          return;
        event.preventDefault();
        open(href, event.currentTarget);
      }}
    />
  );
}
