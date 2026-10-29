'use client';
import { AlertDialog as Primitive } from 'radix-ui';
import { useId, useRef, type ComponentProps, type ReactNode } from 'react';

export const AlertDialog = Primitive.Root;
export const AlertDialogCancel = Primitive.Cancel;
export const AlertDialogAction = Primitive.Action;

/** Shared presentation only; business operations stay in feature components. */
export function AlertDialogContent({
  title,
  description,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: Omit<ComponentProps<typeof Primitive.Content>, 'title'> & {
  title: string;
  description?: ReactNode;
}) {
  const descriptionId = useId();
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-[60] bg-black/50" />
      <Primitive.Content
        {...props}
        onOpenAutoFocus={(event) => {
          previousFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented && previousFocus.current?.isConnected) {
            event.preventDefault();
            previousFocus.current.focus();
          }
        }}
        className="fixed top-1/2 left-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-100 -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border bg-surface p-5 text-foreground shadow-lg [overflow-wrap:anywhere]"
        aria-describedby={description ? descriptionId : undefined}
      >
        <Primitive.Title className="text-lg font-semibold">
          {title}
        </Primitive.Title>
        {description && (
          <Primitive.Description id={descriptionId} asChild>
            <div className="text-sm leading-6 text-muted-foreground">
              {description}
            </div>
          </Primitive.Description>
        )}
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
