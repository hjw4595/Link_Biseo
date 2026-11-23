'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCategories } from '@/features/categories/query/queries';
import { useLink, useLinkMutation, useLinkStats } from '../query/queries';
import { linkErrorMessage } from '../errors';
import { ApiRequestError } from '@/lib/api/client';
import { useLinkEditor } from '../components/link-editor';
import { useDeviceDay } from '../use-device-day';
import { useDetailInteractions } from './use-detail-interactions';

export interface LinkDetailOptions {
  id: string;
  onClose?: () => void;
  returnFocus?: () => HTMLElement | null;
}
export function useLinkDetail({ id, onClose, returnFocus }: LinkDetailOptions) {
  const router = useRouter();
  const deviceDay = useDeviceDay();
  const timeZone = deviceDay?.split('|')[0] ?? 'Asia/Seoul';
  const today = deviceDay?.split('|')[1] ?? null;
  const query = useLink(id);
  const stats = useLinkStats(id, query.isSuccess ? today : null, timeZone);
  const categories = useCategories();
  const mutation = useLinkMutation();
  const editor = useLinkEditor();
  const pending = useRef(false);
  const leaving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const interaction = useDetailInteractions({
    editor,
    busy: mutation.isPending,
    pendingRef: pending,
    leavingRef: leaving,
    onFinishEditing() {
      editor.reset();
      setError(null);
    },
    onClose() {
      if (onClose) onClose();
      else router.push('/links');
    },
    returnFocus,
  });
  const denied =
    (query.error instanceof ApiRequestError &&
      query.error.kind === 'forbidden') ||
    (query.error instanceof ApiRequestError &&
      query.error.kind === 'http' &&
      query.error.status === 404);
  const queryError = linkErrorMessage(query.error);
  const response = denied
    ? undefined
    : (query.data ?? interaction.deleteSnapshot ?? undefined);
  const editing = editor.draft !== null;
  const sheet = onClose !== undefined;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || denied) return;
    if (!editor.dirty) {
      interaction.finishEditing();
      return;
    }
    if (
      editor.input.categoryId &&
      !categories.data?.some(
        (category) => category.id === editor.input.categoryId,
      )
    ) {
      setError('카테고리를 다시 선택해 주세요.');
      return;
    }
    pending.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({ type: 'save', id, input: editor.input });
      interaction.finishEditing();
      setMessage('정보를 수정했어요.');
    } catch (reason) {
      setError(linkErrorMessage(reason));
    } finally {
      pending.current = false;
    }
  }
  async function remove() {
    if (pending.current || denied) return false;
    pending.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({ type: 'delete', id });
      leaving.current = true;
      if (onClose) onClose();
      else router.replace('/links');
      return true;
    } catch (reason) {
      setError(linkErrorMessage(reason));
      return false;
    } finally {
      if (!leaving.current) pending.current = false;
    }
  }
  async function copyUrl() {
    if (!response) return;
    setMessage('');
    try {
      await navigator.clipboard.writeText(response.url);
      setMessage('URL을 복사했어요.');
    } catch {
      setMessage('URL을 복사하지 못했어요. 주소를 직접 선택해 복사해 주세요.');
    }
  }

  const missing =
    query.error instanceof ApiRequestError &&
    query.error.kind === 'http' &&
    query.error.status === 404;
  function beginEditing() {
    if (!response) return;
    setError(null);
    setMessage('');
    interaction.beginEditing(response);
  }
  function requestDelete() {
    if (!response) return;
    setError(null);
    interaction.requestDelete(response);
  }
  function confirm() {
    if (interaction.confirmation === 'delete') return remove();
    if (interaction.confirmation === 'close') interaction.finishClose();
    else interaction.finishEditing();
    return true;
  }
  return {
    query,
    stats,
    categories,
    editor,
    interaction,
    error,
    message,
    denied,
    queryError,
    response,
    editing,
    sheet,
    missing,
    timeZone,
    today,
    busy: mutation.isPending,
    save,
    copyUrl,
    beginEditing,
    requestDelete,
    confirm,
  };
}
