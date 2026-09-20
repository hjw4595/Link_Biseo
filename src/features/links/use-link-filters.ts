'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { LinkSort } from '@/contracts/links';

export interface LinkFilterState {
  q: string;
  categoryId?: string;
  favorite: boolean;
  sort: LinkSort;
}
export function isLinkSort(value: string | null): value is LinkSort {
  return (
    value === 'default' ||
    value === 'recent' ||
    value === 'frequent' ||
    value === 'smart'
  );
}
function readFilters(params: URLSearchParams): LinkFilterState {
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    categoryId: params.get('categoryId') || undefined,
    favorite: params.get('favorite') === 'true',
    sort: isLinkSort(sort) ? sort : 'default',
  };
}
const defaults: LinkFilterState = { q: '', favorite: false, sort: 'default' };

export function useLinkFilters() {
  const serialized = useSearchParams().toString();
  const [observed, setObserved] = useState(serialized);
  const [filters, setFilters] = useState(() =>
    readFilters(new URLSearchParams(serialized)),
  );
  // External URL navigation/back restores conditions without a remount key.
  // Local input updates remain synchronous while Next observes native history.
  if (observed !== serialized) {
    setObserved(serialized);
    setFilters(readFilters(new URLSearchParams(serialized)));
  }
  function change(patch: Partial<LinkFilterState>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    const url = new URL(window.location.href);
    for (const key of ['q', 'categoryId', 'favorite', 'sort'])
      url.searchParams.delete(key);
    if (next.q) url.searchParams.set('q', next.q);
    if (next.categoryId) url.searchParams.set('categoryId', next.categoryId);
    if (next.favorite) url.searchParams.set('favorite', 'true');
    if (next.sort !== 'default') url.searchParams.set('sort', next.sort);
    window.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  const active = Boolean(
    filters.q ||
    filters.categoryId ||
    filters.favorite ||
    filters.sort !== 'default',
  );
  return {
    filters,
    change,
    active,
    reset: () => change({ ...defaults, categoryId: undefined }),
  };
}
export type LinkFilterControls = ReturnType<typeof useLinkFilters>;
