'use client';
import { useState } from 'react';
import type { LinkResponse, UpdateLinkRequest } from '@/contracts/links';

// One snapshot per explicit edit entry; query refetches never initialize this draft.
export function useLinkEditor() {
  const [draft, setDraft] = useState<{
    initial: LinkResponse;
    title: string;
    category: string;
    description: string;
  } | null>(null);
  const input: UpdateLinkRequest = {};
  if (draft) {
    if (
      draft.title !== draft.initial.title &&
      draft.title.trim() !== draft.initial.title.trim()
    )
      input.customTitle = draft.title.trim() || null;
    if (draft.category !== (draft.initial.categoryId ?? ''))
      input.categoryId = draft.category || null;
    if (draft.description !== (draft.initial.description ?? ''))
      input.customDescription = draft.description || null;
  }
  return {
    draft,
    input,
    dirty: Object.keys(input).length > 0,
    begin(link: LinkResponse) {
      setDraft({
        initial: link,
        title: link.title,
        category: link.categoryId ?? '',
        description: link.description ?? '',
      });
    },
    update(field: 'title' | 'category' | 'description', value: string) {
      setDraft((previous) =>
        previous ? { ...previous, [field]: value } : previous,
      );
    },
    reset() {
      setDraft(null);
    },
  };
}
