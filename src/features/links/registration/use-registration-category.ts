'use client';
import { useEffect, useRef, useState } from 'react';
import type { CreateLinkRequest } from '@/contracts/links';
import { useCategories } from '@/features/categories/query/queries';

export const draftPrefix = 'draft:';
export function useRegistrationCategory(
  initialCategoryId: string,
  returnToLinks: boolean,
) {
  const query = useCategories();
  const categories = query.data ?? [];
  const initialSelection =
    initialCategoryId === 'uncategorized' ? '' : initialCategoryId;
  const [categoryId, setCategoryId] = useState(initialSelection);
  const [categoryEdited, setCategoryEdited] = useState(false);
  const [entryCategory, setEntryCategory] = useState<{
    id: string | null;
  } | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const categoryInput = useRef<HTMLSelectElement>(null);
  const newCategoryInput = useRef<HTMLInputElement>(null);
  const categoryTrigger = useRef<HTMLButtonElement>(null);
  if (entryCategory === null && query.isSuccess) {
    const initial = categories.find((c) => c.id === initialCategoryId);
    setEntryCategory({ id: initial?.id ?? null });
    if (initialCategoryId && !initial && !categoryEdited) setCategoryId('');
  }
  const invalidInitialCategory =
    !!initialCategoryId &&
    initialCategoryId !== 'uncategorized' &&
    entryCategory !== null &&
    entryCategory.id === null;
  const cancelDestination = returnToLinks
    ? initialCategoryId === 'uncategorized'
      ? '/links?categoryId=uncategorized'
      : entryCategory?.id && categories.some((c) => c.id === entryCategory.id)
        ? `/links?categoryId=${encodeURIComponent(entryCategory.id)}`
        : '/links'
    : entryCategory?.id && categories.some((c) => c.id === entryCategory.id)
      ? `/category/${encodeURIComponent(entryCategory.id)}`
      : '/';
  useEffect(() => {
    if (categoryOpen) newCategoryInput.current?.focus();
  }, [categoryOpen]);
  function closeCategory() {
    setCategoryOpen(false);
    setNewCategory('');
    setCategoryError(null);
    categoryTrigger.current?.focus();
  }
  function addCategory() {
    const name = newCategory.trim();
    if (!name || name.length > 100 || name.includes('\u0000')) {
      setCategoryError('카테고리 이름을 1~100자로 입력해 주세요.');
      newCategoryInput.current?.focus();
      return;
    }
    // Immediate convenience matching only. PostgreSQL lower/[:space:] is authoritative on save.
    // Only fold ASCII locally: locale-sensitive Unicode equality is decided by PostgreSQL.
    const nameKey = (value: string) =>
      value
        .replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '')
        .replace(/[A-Z]/g, (c) => c.toLowerCase());
    const existing = categories.find((c) => nameKey(c.name) === nameKey(name));
    const draft = drafts.find((c) => c.toLowerCase() === name.toLowerCase());
    if (!existing && !draft) setDrafts([...drafts, name]);
    setCategoryId(existing?.id ?? draftPrefix + (draft ?? name));
    setCategoryEdited(true);
    closeCategory();
  }
  function validateSelection(): Pick<
    CreateLinkRequest,
    'categoryId' | 'newCategoryName'
  > | null {
    if (categoryOpen) {
      setCategoryError('추가하거나 취소한 뒤 등록해 주세요.');
      newCategoryInput.current?.focus();
      return null;
    }
    const draftName = categoryId.startsWith(draftPrefix)
      ? categoryId.slice(draftPrefix.length)
      : undefined;
    if (
      categoryId &&
      !(draftName
        ? drafts.includes(draftName)
        : categories.some((c) => c.id === categoryId))
    ) {
      setCategoryError('카테고리를 다시 선택해 주세요.');
      categoryInput.current?.focus();
      return null;
    }
    return draftName
      ? { newCategoryName: draftName }
      : { categoryId: categoryId || null };
  }
  return {
    query,
    categories,
    categoryId,
    categoryEdited,
    entryCategory,
    drafts,
    categoryOpen,
    newCategory,
    categoryError,
    invalidInitialCategory,
    categoryInput,
    newCategoryInput,
    categoryTrigger,
    cancelDestination,
    closeCategory,
    addCategory,
    validateSelection,
    dirty: !!(
      drafts.length ||
      newCategory ||
      categoryId !==
        (entryCategory ? (entryCategory.id ?? '') : initialSelection)
    ),
    toggleCategory() {
      if (categoryOpen) closeCategory();
      else setCategoryOpen(true);
    },
    changeCategory(value: string) {
      setCategoryEdited(true);
      setCategoryId(value);
      setCategoryError(null);
    },
    changeName(value: string) {
      setNewCategory(value);
      setCategoryError(null);
    },
  };
}
