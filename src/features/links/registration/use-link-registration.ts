'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useLinkMutation } from '../query/queries';
import { linkErrorMessage } from '../errors';
import { useRegistrationPreview } from './use-registration-preview';
import { useRegistrationCategory } from './use-registration-category';
import { useRegistrationExit } from './use-registration-exit';
import type { LinkRegistrationOptions } from './types';

export function useLinkRegistration({
  initialCategoryId = '',
  returnToLinks = false,
  onClose,
  onRegistered,
  returnFocus,
}: LinkRegistrationOptions) {
  const category = useRegistrationCategory(initialCategoryId, returnToLinks);
  const mutation = useLinkMutation();
  const router = useRouter();
  const pending = useRef(false);
  const completed = useRef(false);
  const preview = useRegistrationPreview();
  const [favorite, setFavorite] = useState(false);
  const [note, setNote] = useState('');
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (descriptionOpen) descriptionInput.current?.focus();
  }, [descriptionOpen]);
  const dirty = !!(preview.url || note || favorite || category.dirty);
  const exit = useRegistrationExit({
    dirty,
    saving,
    pendingRef: pending,
    completedRef: completed,
    returnFocus,
    onExit: () => {
      if (onClose) onClose();
      else router.push(category.cancelDestination);
    },
  });
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      pending.current ||
      saving ||
      category.query.isPending ||
      category.query.isError
    )
      return;
    if (!preview.parsed) {
      preview.reportInvalid();
      return;
    }
    const categoryInput = category.validateSelection();
    if (!categoryInput) return;
    pending.current = true;
    setSaving(true);
    setApiError(null);
    try {
      const saved = await mutation.mutateAsync({
        type: 'save',
        input: {
          url: preview.parsed.href,
          ...categoryInput,
          customTitle: preview.displayedTitle.trim() || null,
          customDescription: note || null,
          isFavorite: favorite,
        },
      });
      if (saved && 'id' in saved) {
        completed.current = true;
        window.dispatchEvent(new Event('link-registered'));
        const destination = returnToLinks
          ? `/links?categoryId=${saved.categoryId ? encodeURIComponent(saved.categoryId) : 'uncategorized'}`
          : category.entryCategory?.id
            ? saved.categoryId
              ? `/category/${encodeURIComponent(saved.categoryId)}`
              : '/links'
            : '/links/' + saved.id;
        if (onRegistered) onRegistered(destination);
        else router.replace(destination);
      }
    } catch (reason) {
      setApiError(linkErrorMessage(reason));
    } finally {
      if (!completed.current) {
        pending.current = false;
        setSaving(false);
      }
    }
  }
  return {
    category,
    preview,
    exit,
    saving,
    apiError,
    handleSubmit,
    submitDisabled:
      !preview.parsed ||
      category.query.isPending ||
      category.query.isError ||
      category.categoryOpen,
    details: {
      favorite,
      note,
      descriptionOpen,
      descriptionInput,
      toggleFavorite: () => setFavorite(!favorite),
      changeNote: (value: string) => setNote(value),
      toggleDescription: () => setDescriptionOpen(!descriptionOpen),
    },
  };
}
