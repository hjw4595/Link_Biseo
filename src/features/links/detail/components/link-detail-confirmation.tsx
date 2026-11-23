'use client';
import type { LinkResponse } from '@/contracts/links';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { useDetailInteractions } from '../use-detail-interactions';

export function LinkDetailConfirmation({
  confirmation,
  onOpenChange,
  onCloseAutoFocus,
  response,
  denied,
  busy,
  error,
  onConfirm,
}: {
  confirmation: ReturnType<typeof useDetailInteractions>['confirmation'];
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  response: LinkResponse | undefined;
  denied: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => boolean | Promise<boolean>;
}) {
  return (
    <ConfirmDialog
      open={confirmation !== null && (confirmation !== 'delete' || !denied)}
      onOpenChange={onOpenChange}
      title={
        confirmation === 'delete'
          ? `'${response?.title ?? ''}'를 삭제할까요?`
          : '변경 사항을 버릴까요?'
      }
      description={
        confirmation === 'delete'
          ? '삭제한 링크는 복구할 수 없습니다.'
          : '저장하지 않은 변경사항이 사라집니다.'
      }
      confirmLabel={
        confirmation === 'delete' ? '링크 삭제' : '변경 사항 버리기'
      }
      cancelLabel={confirmation === 'delete' ? '취소' : '계속 편집'}
      variant="destructive"
      pending={busy}
      error={confirmation === 'delete' ? error : undefined}
      onConfirm={onConfirm}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  );
}
