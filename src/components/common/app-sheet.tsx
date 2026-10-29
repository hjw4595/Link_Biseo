'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BusyContext = createContext(false);
type ContentProps = ComponentProps<typeof SheetContent>;
export interface AppSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Presentation lock only. Features retain mutation and dirty-draft policies. */
  busy?: boolean;
  className?: string;
  onOpenAutoFocus?: ContentProps['onOpenAutoFocus'];
  onCloseAutoFocus?: ContentProps['onCloseAutoFocus'];
}

export function AppSheet({
  open,
  onOpenChange,
  children,
  busy = false,
  className,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: AppSheetProps) {
  const viewport = useSyncExternalStore(
    useCallback(
      (notify) => {
        const current = open ? window.visualViewport : null;
        if (!current) return () => {};
        current.addEventListener('resize', notify);
        current.addEventListener('scroll', notify);
        return () => {
          current.removeEventListener('resize', notify);
          current.removeEventListener('scroll', notify);
        };
      },
      [open],
    ),
    () =>
      open && window.visualViewport
        ? `${window.visualViewport.height}:${window.visualViewport.offsetTop}`
        : '',
    () => '',
  );
  const [height, top] = viewport.split(':').map(Number);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) return;
    // Capture the opener before React autoFocus moves into portalled content.
    const remember = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !active.closest('[data-app-sheet]'))
        returnFocus.current = active;
    };
    remember();
    document.addEventListener('focusin', remember);
    return () => document.removeEventListener('focusin', remember);
  }, [open]);
  return (
    <BusyContext.Provider value={busy}>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (next || !busy) onOpenChange(next);
        }}
      >
        <SheetContent
          data-app-sheet=""
          // A keyboard may shrink the visual viewport without changing 100dvh.
          style={viewport ? { height, top } : undefined}
          side="right"
          showCloseButton={false}
          className={cn(
            'h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none p-0 sm:max-w-none lg:max-w-lg',
            className,
          )}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (
              !event.defaultPrevented &&
              returnFocus.current?.isConnected &&
              returnFocus.current.getClientRects().length
            ) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          {children}
        </SheetContent>
      </Sheet>
    </BusyContext.Provider>
  );
}

export function AppSheetHeader({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  const busy = useContext(BusyContext);
  return (
    <header
      data-slot="app-sheet-header"
      className="flex shrink-0 items-center gap-3 px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="min-w-0 flex-1">
        <SheetTitle className="break-words">{title}</SheetTitle>
        {/* An empty, silent description keeps Radix's optional-description anchor valid. */}
        <SheetDescription className={description ? 'mt-1' : 'sr-only'}>
          {description}
        </SheetDescription>
      </div>
      <SheetClose asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy}
          aria-label="닫기"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </SheetClose>
    </header>
  );
}

export function AppSheetContent({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-sheet-body"
      className={cn(
        'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-4',
        className,
      )}
      {...props}
    />
  );
}

export function AppSheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-sheet-footer"
      className={cn(
        'grid shrink-0 auto-cols-fr grid-flow-col gap-3 border-t bg-background px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
        className,
      )}
      {...props}
    />
  );
}
