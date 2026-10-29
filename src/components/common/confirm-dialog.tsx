'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  /** Explicit true closes; false or rejection keeps the dialog open. */
  onConfirm: () => boolean | Promise<boolean>;
  pending?: boolean;
  error?: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  onConfirm,
  pending = false,
  error,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  const [running, setRunning] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef(false),
    mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const busy = pending || running;
  async function confirm() {
    if (lock.current || pending) return;
    lock.current = true;
    setRunning(true);
    setFailed(false);
    try {
      const success = await onConfirm();
      if (mounted.current) {
        if (success === true) onOpenChange(false);
        else setFailed(true);
      }
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      lock.current = false;
      if (mounted.current) setRunning(false);
    }
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!busy && !lock.current) {
          setFailed(false);
          onOpenChange(value);
        }
      }}
    >
      <AlertDialogContent
        title={title}
        description={description}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
          if (busy || lock.current) event.preventDefault();
        }}
      >
        {(error || failed) && (
          <p role="alert" className="text-sm text-destructive">
            {error || '작업을 완료하지 못했어요. 다시 시도해 주세요.'}
          </p>
        )}
        {busy && (
          <p role="status" className="sr-only">
            처리 중이에요.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button variant="secondary" disabled={busy}>
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <Button
            variant={variant}
            loading={busy}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
