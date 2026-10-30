'use client';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Star } from 'lucide-react';
import {
  AppSheet,
  AppSheetHeader,
  AppSheetContent,
  AppSheetFooter,
} from '@/components/common/app-sheet';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useNavigationGuard } from '@/components/common/navigation-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useCategories,
  useLinkMutation,
  useLinkPreview,
} from '@/lib/query/product';
import { linkErrorMessage } from '@/lib/api/links';
import { categoryErrorMessage } from '@/lib/api/categories';
import { RequestError } from '@/components/common/request-error';
import { LinkFavicon } from './link-favicon';
import { createLinkUrl } from '../create-url';

const draftPrefix = 'draft:';
export function AddLinkForm({
  initialCategoryId = '',
  returnToLinks = false,
  onClose,
  onRegistered,
  returnFocus,
}: {
  initialCategoryId?: string;
  returnToLinks?: boolean;
  onClose?: () => void;
  onRegistered?: (destination: string) => void;
  returnFocus?: RefObject<HTMLAnchorElement | null>;
}) {
  const query = useCategories();
  const categories = query.data ?? [];
  const mutation = useLinkMutation();
  const router = useRouter();
  const guard = useNavigationGuard();
  const pending = useRef(false);
  const completed = useRef(false);
  const [url, setUrl] = useState('');
  const parsed = createLinkUrl(url);
  const normalized = parsed?.href ?? null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const preview = useLinkPreview(previewUrl);
  const [title, setTitle] = useState<{
    url: string | null;
    value: string;
    edited: boolean;
  }>({ url: null, value: '', edited: false });
  // A title belongs to its URL. Old responses and old user titles never migrate to another URL.
  const metadata = normalized === previewUrl ? preview.data : undefined;
  const displayedTitle =
    title.url === normalized && title.edited
      ? title.value
      : (metadata?.title?.slice(0, 200) ?? '');
  const [favorite, setFavorite] = useState(false);
  const [note, setNote] = useState('');
  const [descriptionOpen, setDescriptionOpen] = useState(false);
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
  const [urlError, setUrlError] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);
  const categoryInput = useRef<HTMLSelectElement>(null);
  const newCategoryInput = useRef<HTMLInputElement>(null);
  const categoryTrigger = useRef<HTMLButtonElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const closeFocus = useRef<HTMLElement | null>(null);
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
  const dirty = !!(
    url ||
    note ||
    favorite ||
    drafts.length ||
    newCategory ||
    categoryId !== (entryCategory ? (entryCategory.id ?? '') : initialSelection)
  );
  const live = useRef({ dirty, saving });
  useEffect(() => {
    live.current = { dirty, saving };
  }, [dirty, saving]);
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewUrl(normalized), 400);
    return () => window.clearTimeout(timer);
  }, [normalized]);
  useEffect(() => {
    if (categoryOpen) newCategoryInput.current?.focus();
  }, [categoryOpen]);
  useEffect(() => {
    if (descriptionOpen) descriptionInput.current?.focus();
  }, [descriptionOpen]);
  useEffect(() => {
    const allow = () =>
      completed.current ||
      (!live.current.saving &&
        (!live.current.dirty ||
          window.confirm('작성 중인 링크를 버리고 이동할까요?')));
    const unregister = guard.register(allow);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!completed.current && (live.current.dirty || live.current.saving)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    let restoring = false;
    const navigation =
      'navigation' in window && window.navigation instanceof EventTarget
        ? window.navigation
        : null;
    const navigate = (event: Event) => {
      if (
        'navigationType' in event &&
        event.navigationType === 'traverse' &&
        event.cancelable &&
        !allow()
      )
        event.preventDefault();
    };
    navigation?.addEventListener('navigate', navigate);
    const pop = (event: PopStateEvent) => {
      if (navigation) return;
      if (restoring) {
        restoring = false;
        return;
      }
      if (!allow()) {
        event.stopImmediatePropagation();
        restoring = true;
        window.history.go(1);
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', pop, true);
    return () => {
      unregister();
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', pop, true);
      navigation?.removeEventListener('navigate', navigate);
    };
  }, [guard]);

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
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || saving || query.isPending || query.isError) return;
    if (!parsed) {
      setUrlError(true);
      urlInput.current?.focus();
      return;
    }
    if (categoryOpen) {
      setCategoryError('추가하거나 취소한 뒤 등록해 주세요.');
      newCategoryInput.current?.focus();
      return;
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
      return;
    }
    pending.current = true;
    setSaving(true);
    setApiError(null);
    try {
      const saved = await mutation.mutateAsync({
        type: 'save',
        input: {
          url: parsed.href,
          ...(draftName
            ? { newCategoryName: draftName }
            : { categoryId: categoryId || null }),
          customTitle: displayedTitle.trim() || null,
          customDescription: note || null,
          isFavorite: favorite,
        },
      });
      if (saved && 'id' in saved) {
        completed.current = true;
        window.dispatchEvent(new Event('link-registered'));
        const destination = returnToLinks
          ? `/links?categoryId=${saved.categoryId ? encodeURIComponent(saved.categoryId) : 'uncategorized'}`
          : entryCategory?.id
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
  function close() {
    completed.current = true;
    if (onClose) onClose();
    else router.push(cancelDestination);
  }
  function requestClose() {
    if (pending.current || saving) return;
    if (discardOpen) {
      setDiscardOpen(false);
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[data-app-sheet]'))
      closeFocus.current = active;
    if (dirty) setDiscardOpen(true);
    else close();
  }
  return (
    <>
      <AppSheet
        open
        busy={saving}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          urlInput.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (!returnFocus) return;
          event.preventDefault();
          const fallback = [
            ...document.querySelectorAll<HTMLElement>(
              '[data-link-registration-trigger], main a[href], main button:not([disabled])',
            ),
          ].find((node) => node.getClientRects().length);
          const target =
            returnFocus.current?.isConnected &&
            returnFocus.current.getClientRects().length
              ? returnFocus.current
              : fallback;
          target?.focus({ preventScroll: true });
        }}
      >
        <AppSheetHeader title="링크 등록" />
        <AppSheetContent>
          <form
            id="add-link-form"
            noValidate
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="flex flex-col gap-8 py-4"
            aria-busy={saving}
            aria-describedby={apiError ? 'link-registration-error' : undefined}
          >
            <fieldset disabled={saving} className="min-w-0 space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="link-url"
                  className="block text-list font-medium"
                >
                  URL
                </label>
                <Input
                  ref={urlInput}
                  id="link-url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="https://example.com"
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setUrlError(false);
                  }}
                  onBlur={() => {
                    setUrl(url.trim());
                    setUrlError(!!url.trim() && !parsed);
                  }}
                  required
                  maxLength={2048}
                  aria-invalid={urlError}
                  aria-describedby={urlError ? 'url-error' : undefined}
                />
                {urlError && (
                  <p
                    id="url-error"
                    role="alert"
                    className="text-meta text-destructive"
                  >
                    올바른 URL을 입력해 주세요.
                  </p>
                )}
              </div>
              {parsed && (
                <section
                  aria-label="링크 미리보기"
                  className="surface-card space-y-5 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <LinkFavicon
                      key={metadata?.faviconUrl ?? normalized}
                      src={metadata?.faviconUrl ?? null}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">링크 미리보기</p>
                      <p className="truncate text-meta text-muted-foreground">
                        {parsed.hostname}
                      </p>
                    </div>
                    {previewUrl === normalized && preview.isFetching && (
                      <span role="status" aria-label="제목 정보 불러오는 중">
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin text-muted-foreground"
                        />
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="custom-title"
                      className="block text-list font-medium"
                    >
                      제목
                    </label>
                    <Input
                      id="custom-title"
                      value={displayedTitle}
                      placeholder="링크 제목 (선택)"
                      maxLength={200}
                      onChange={(event) =>
                        setTitle({
                          url: normalized,
                          value: event.target.value,
                          edited: true,
                        })
                      }
                    />
                    {previewUrl === normalized &&
                      (preview.isError || metadata?.status === 'failed') && (
                        <p
                          role="status"
                          className="text-meta text-muted-foreground"
                        >
                          제목 정보를 가져오지 못했어요.
                        </p>
                      )}
                  </div>
                </section>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="category" className="text-list font-medium">
                    카테고리
                  </label>
                  <Button
                    ref={categoryTrigger}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-expanded={categoryOpen}
                    aria-controls="new-category-panel"
                    disabled={query.isPending || query.isError}
                    onClick={() =>
                      categoryOpen ? closeCategory() : setCategoryOpen(true)
                    }
                  >
                    {categoryOpen ? (
                      '취소'
                    ) : (
                      <>
                        <Plus aria-hidden="true" className="size-4" />새
                        카테고리
                      </>
                    )}
                  </Button>
                </div>
                <select
                  ref={categoryInput}
                  id="category"
                  className="field-control"
                  value={categoryId}
                  onChange={(event) => {
                    setCategoryEdited(true);
                    setCategoryId(event.target.value);
                    setCategoryError(null);
                  }}
                  aria-describedby={
                    invalidInitialCategory
                      ? 'initial-category-status'
                      : undefined
                  }
                >
                  <option value="">미분류</option>
                  {categoryId &&
                    !categoryId.startsWith(draftPrefix) &&
                    !categories.some((c) => c.id === categoryId) &&
                    entryCategory === null && (
                      <option value={categoryId}>카테고리 확인 중</option>
                    )}
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {drafts.map((name) => (
                    <option key={name} value={draftPrefix + name}>
                      {name}
                    </option>
                  ))}
                </select>
                {query.isPending && (
                  <p role="status" className="text-meta text-muted-foreground">
                    카테고리를 불러오고 있어요.
                  </p>
                )}
                {query.error && (
                  <RequestError
                    text={categoryErrorMessage(query.error)}
                    retry={() => {
                      void query.refetch();
                    }}
                  />
                )}
                {invalidInitialCategory && (
                  <p
                    id="initial-category-status"
                    role="status"
                    className="text-meta break-words text-muted-foreground"
                  >
                    {categoryEdited
                      ? '처음 선택한 카테고리를 찾을 수 없어요. 현재 선택한 카테고리로 저장해요.'
                      : '선택한 카테고리를 찾을 수 없어 미분류로 변경했어요.'}
                  </p>
                )}
                {categoryOpen && (
                  <div
                    id="new-category-panel"
                    className="space-y-3 rounded-sm border p-4"
                  >
                    <label
                      htmlFor="new-category"
                      className="block text-list font-medium"
                    >
                      새 카테고리 이름
                    </label>
                    <Input
                      ref={newCategoryInput}
                      id="new-category"
                      maxLength={100}
                      value={newCategory}
                      onChange={(event) => {
                        setNewCategory(event.target.value);
                        setCategoryError(null);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          addCategory();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          event.stopPropagation();
                          closeCategory();
                        }
                      }}
                      aria-invalid={!!categoryError}
                      aria-describedby={
                        categoryError ? 'category-error' : undefined
                      }
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={closeCategory}
                      >
                        취소
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addCategory}
                      >
                        추가
                      </Button>
                    </div>
                  </div>
                )}
                {categoryError && (
                  <p
                    id="category-error"
                    role="alert"
                    className="text-meta text-destructive"
                  >
                    {categoryError}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-list font-medium">즐겨찾기</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="즐겨찾기"
                  aria-pressed={favorite}
                  onClick={() => setFavorite(!favorite)}
                  className={
                    favorite
                      ? 'text-favorite hover:text-favorite'
                      : 'text-muted-foreground'
                  }
                >
                  <Star
                    aria-hidden="true"
                    className="size-6"
                    fill={favorite ? 'currentColor' : 'none'}
                  />
                </Button>
              </div>
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  aria-expanded={descriptionOpen}
                  aria-controls="description-panel"
                  onClick={() => setDescriptionOpen(!descriptionOpen)}
                >
                  {descriptionOpen
                    ? '설명 접기'
                    : note.trim()
                      ? '설명 작성됨 · 수정'
                      : '+ 설명 추가'}
                </Button>
                <div
                  id="description-panel"
                  hidden={!descriptionOpen}
                  className="space-y-2"
                >
                  <label htmlFor="note" className="block text-list font-medium">
                    설명
                  </label>
                  <Textarea
                    ref={descriptionInput}
                    id="note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="링크에 대한 설명 (선택)"
                    maxLength={2000}
                  />
                </div>
              </div>
            </fieldset>
          </form>
        </AppSheetContent>
        <AppSheetFooter className="grid-flow-row grid-cols-2">
          {apiError && (
            <p
              id="link-registration-error"
              role="alert"
              className="col-span-2 text-sm text-destructive"
            >
              {apiError}
            </p>
          )}
          <Button
            ref={backButton}
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={requestClose}
          >
            취소
          </Button>
          <Button
            type="submit"
            form="add-link-form"
            loading={saving}
            disabled={
              !parsed || query.isPending || query.isError || categoryOpen
            }
          >
            {saving ? '등록 중…' : '링크 등록'}
          </Button>
        </AppSheetFooter>
      </AppSheet>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="작성 중인 링크를 버릴까요?"
        description="저장하지 않은 입력은 사라져요."
        confirmLabel="버리고 나가기"
        onConfirm={() => {
          close();
          return true;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!completed.current)
            (closeFocus.current?.isConnected
              ? closeFocus.current
              : backButton.current
            )?.focus({ preventScroll: true });
        }}
      />
    </>
  );
}
