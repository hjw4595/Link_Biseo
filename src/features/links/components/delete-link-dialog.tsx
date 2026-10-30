'use client';
import type { RefObject } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
export function DeleteLinkDialog({
  open,
  onClose,
  onConfirm,
  busy,
  error,
  returnFocus,
  confirmLabel = '삭제',
  title = '이 링크를 삭제할까요?',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => boolean | Promise<boolean>;
  busy: boolean;
  error?: string;
  returnFocus?: RefObject<HTMLElement | null>;
  confirmLabel?: string;
  title?: string;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={title}
      description="삭제한 링크는 복구할 수 없습니다."
      variant="destructive"
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      pending={busy}
      error={error}
      onCloseAutoFocus={(event) => {
        if (returnFocus?.current?.isConnected) {
          event.preventDefault();
          returnFocus.current.focus();
        }
      }}
    />
  );
}
