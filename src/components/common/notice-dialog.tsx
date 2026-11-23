'use client';
import { useRef, type ComponentProps, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function NoticeDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '확인',
  onCloseAutoFocus,
  secondaryAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  secondaryAction?: ReactNode;
  onCloseAutoFocus?: ComponentProps<
    typeof AlertDialogContent
  >['onCloseAutoFocus'];
}) {
  const action = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        title={title}
        description={description}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          action.current?.focus();
        }}
      >
        <div className="flex flex-wrap justify-end gap-2">
          {secondaryAction}
          <AlertDialogAction asChild>
            <Button ref={action}>{confirmLabel}</Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
