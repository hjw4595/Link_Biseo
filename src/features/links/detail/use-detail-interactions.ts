'use client';
import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type FocusEvent,
} from 'react';
import type { LinkResponse } from '@/contracts/links';
import type { useLinkEditor } from '../components/link-editor';

type DetailInteractionOptions = {
  editor: ReturnType<typeof useLinkEditor>;
  busy: boolean;
  pendingRef: RefObject<boolean>;
  leavingRef: RefObject<boolean>;
  onFinishEditing: () => void;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
};
export function useDetailInteractions({
  editor,
  busy,
  pendingRef,
  leavingRef,
  onFinishEditing,
  onClose,
  returnFocus,
}: DetailInteractionOptions) {
  const editing = editor.draft !== null;
  const nameInput = useRef<HTMLInputElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const confirmTrigger = useRef<HTMLElement | null>(null);
  const confirmationKind = useRef<'delete' | 'cancel' | 'close' | null>(null);
  const [confirmation, setConfirmation] = useState<
    'delete' | 'cancel' | 'close' | null
  >(null);
  const [deleteSnapshot, setDeleteSnapshot] = useState<LinkResponse | null>(
    null,
  );
  const focusView = useRef(false);
  useEffect(() => {
    if (editing || busy || !focusView.current) return;
    const frame = requestAnimationFrame(() => {
      if (editButton.current && !editButton.current.disabled) {
        editButton.current.focus({ preventScroll: true });
        focusView.current = false;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editing, busy]);
  function finishEditing() {
    focusView.current = true;
    onFinishEditing();
  }
  function finishClose() {
    leavingRef.current = true;
    onClose();
  }
  function requestExit(action: 'cancel' | 'close') {
    if (pendingRef.current) return;
    // A rapid Escape during Radix layer registration can still reach the parent.
    if (confirmation) {
      setConfirmation(null);
      setDeleteSnapshot(null);
      return;
    }
    if (!editing || !editor.dirty) {
      if (action === 'close') finishClose();
      else finishEditing();
      return;
    }
    const active = document.activeElement;
    confirmTrigger.current =
      active instanceof HTMLElement && region.current?.contains(active)
        ? active
        : lastFocus.current;
    confirmationKind.current = action;
    setConfirmation(action);
  }

  function requestDelete(response: LinkResponse) {
    setDeleteSnapshot(response);
    confirmationKind.current = 'delete';
    confirmTrigger.current = deleteButton.current;
    setConfirmation('delete');
  }
  function beginEditing(response: LinkResponse) {
    editor.begin(response);
    requestAnimationFrame(() => nameInput.current?.focus());
  }
  function changeConfirmation(open: boolean) {
    if (!open) {
      setConfirmation(null);
      setDeleteSnapshot(null);
    }
  }
  function restoreConfirmationFocus(event: Event) {
    event.preventDefault();
    if (leavingRef.current) return;
    const target =
      confirmationKind.current === 'delete'
        ? deleteButton.current
        : !editing
          ? editButton.current
          : confirmTrigger.current;
    if (target?.isConnected && !target.matches(':disabled'))
      target.focus({ preventScroll: true });
    else
      (nameInput.current ?? deleteButton.current ?? editButton.current)?.focus({
        preventScroll: true,
      });
  }
  function captureFocus(event: FocusEvent<HTMLDivElement>) {
    if (
      event.target instanceof HTMLElement &&
      event.currentTarget.contains(event.target)
    )
      lastFocus.current = event.target;
  }
  function restoreSheetFocus(event: Event) {
    event.preventDefault();
    returnFocus?.()?.focus({ preventScroll: true });
  }
  return {
    nameInput,
    region,
    editButton,
    deleteButton,
    confirmation,
    deleteSnapshot,
    finishEditing,
    finishClose,
    requestExit,
    requestDelete,
    beginEditing,
    changeConfirmation,
    restoreConfirmationFocus,
    captureFocus,
    restoreSheetFocus,
  };
}
