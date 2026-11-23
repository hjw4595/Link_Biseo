'use client';
import type { RefObject } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { ActionButtons } from '@/components/common/action-buttons';
import { Button } from '@/components/ui/button';

type LinkDetailActionsProps = {
  editing: boolean;
  busy: boolean;
  dirty: boolean;
  editButton: RefObject<HTMLButtonElement | null>;
  deleteButton: RefObject<HTMLButtonElement | null>;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
};
export function LinkDetailActions({
  editing,
  busy,
  dirty,
  editButton,
  deleteButton,
  onEdit,
  onDelete,
  onCancel,
}: LinkDetailActionsProps) {
  return (
    <>
      {editing ? (
        <ActionButtons
          cancel={{
            variant: 'ghost',
            disabled: busy,
            onClick: onCancel,
            children: '취소',
          }}
          primary={{
            form: 'link-edit-form',
            type: 'submit',
            loading: busy,
            disabled: !dirty,
            children: '변경 저장',
          }}
        />
      ) : (
        <>
          <Button
            ref={deleteButton}
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            삭제
          </Button>
          <Button
            ref={editButton}
            type="button"
            disabled={busy}
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" className="size-4" />
            정보 수정
          </Button>
        </>
      )}
    </>
  );
}
