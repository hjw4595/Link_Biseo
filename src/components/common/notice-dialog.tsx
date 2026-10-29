'use client';
import { useRef, type ReactNode } from 'react';
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
}) {
  const action = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        title={title}
        description={description}
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          action.current?.focus();
        }}
      >
        <div className="flex justify-end">
          <AlertDialogAction asChild>
            <Button ref={action}>{confirmLabel}</Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
