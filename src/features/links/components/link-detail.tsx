'use client';
import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Copy, Pencil, Trash2 } from 'lucide-react';
import type { LinkResponse } from '@/contracts/links';
import { TopBar } from '@/components/common/top-bar';
import { MissingResource } from '@/components/common/missing-resource';
import { EmptyState } from '@/components/common/empty-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AppSheet,
  AppSheetHeader,
  AppSheetContent,
  AppSheetFooter,
} from '@/components/common/app-sheet';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import {
  useCategories,
  useLink,
  useLinkMutation,
  useLinkStats,
} from '@/lib/query/product';
import { LinkApiError, linkErrorMessage } from '@/lib/api/links';
import { ApiRequestError } from '@/lib/api/client';
import { RequestError } from '@/components/common/request-error';
import { useLinkEditor } from './link-editor';
import { LinkFavicon } from './link-favicon';
import { usageDateLabel } from '../usage-date';
import { useDeviceDay } from '../use-device-day';
import { dateInZone } from '@/lib/time-zone';
import { LinkUsage } from './link-usage';
import { ExternalLink } from './external-link';
import { useLinkOpen } from '../use-link-open';
import { LinkOpenFeedback } from './link-open-feedback';
import { linkView } from '../types';

export function LinkDetail({ id }: { id: string }) {
  return <LinkDetailController key={id} id={id} />;
}
export function LinkDetailSheet({
  id,
  onClose,
  returnFocus,
}: {
  id: string;
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  return (
    <LinkDetailController
      key={id}
      id={id}
      onClose={onClose}
      returnFocus={returnFocus}
    />
  );
}
function LinkDetailController({
  id,
  onClose,
  returnFocus,
}: {
  id: string;
  onClose?: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const router = useRouter();
  const deviceDay = useDeviceDay();
  const timeZone = deviceDay?.split('|')[0] ?? 'Asia/Seoul';
  const today = deviceDay?.split('|')[1] ?? null;
  const query = useLink(id);
  const stats = useLinkStats(id, query.isSuccess ? today : null, timeZone);
  const categories = useCategories();
  const mutation = useLinkMutation();
  const editor = useLinkEditor();
  const nameInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const leaving = useRef(false);
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const denied =
    (query.error instanceof ApiRequestError &&
      query.error.kind === 'forbidden') ||
    (query.error instanceof LinkApiError && query.error.status === 404);
  const queryError = linkErrorMessage(query.error);
  const response = denied
    ? undefined
    : (query.data ?? deleteSnapshot ?? undefined);
  const editing = editor.draft !== null;
  const sheet = onClose !== undefined;
  const focusView = useRef(false);
  useEffect(() => {
    if (editing || mutation.isPending || !focusView.current) return;
    const frame = requestAnimationFrame(() => {
      if (editButton.current && !editButton.current.disabled) {
        editButton.current.focus({ preventScroll: true });
        focusView.current = false;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editing, mutation.isPending]);
  function finishEditing() {
    focusView.current = true;
    editor.reset();
    setError(null);
  }
  function finishClose() {
    leaving.current = true;
    if (onClose) onClose();
    else router.push('/links');
  }
  function requestExit(action: 'cancel' | 'close') {
    if (pending.current) return;
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
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || denied) return;
    if (!editor.dirty) {
      finishEditing();
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
      finishEditing();
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
  if (
    !sheet &&
    denied &&
    query.error instanceof LinkApiError &&
    query.error.status === 404
  )
    return <MissingResource kind="링크" />;
  const content = (
    <>
      <div
        ref={region}
        className="flex min-h-0 flex-1 flex-col"
        onFocusCapture={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.currentTarget.contains(event.target)
          )
            lastFocus.current = event.target;
        }}
      >
        {sheet ? (
          <AppSheetHeader
            title={editing ? '링크 상세 · 수정 중' : '링크 상세'}
          />
        ) : (
          <TopBar
            title={editing ? '링크 상세 · 수정 중' : '링크 상세'}
            backHref="/links"
          />
        )}
        <AppSheetContent className={sheet ? undefined : 'screen-content'}>
          {!response ? (
            denied &&
            query.error instanceof LinkApiError &&
            query.error.status === 404 ? (
              <EmptyState
                title="링크를 찾을 수 없어요"
                description="삭제되었거나 접근할 수 없는 링크예요."
              />
            ) : query.error ? (
              <RequestError
                text={queryError}
                retry={() => {
                  void query.refetch();
                }}
              />
            ) : (
              <div role="status" className="space-y-5 py-4">
                <span className="sr-only">링크를 불러오고 있어요.</span>
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )
          ) : (
            <form
              id="link-edit-form"
              className="space-y-6 py-4"
              onSubmit={(event) => {
                void save(event);
              }}
            >
              {query.error && (
                <RequestError
                  text={queryError}
                  retry={() => {
                    void query.refetch();
                  }}
                />
              )}
              <LinkDetailContent
                response={response}
                editor={editor}
                nameInput={nameInput}
                categories={categories}
                stats={stats}
                timeZone={timeZone}
                today={today}
                busy={mutation.isPending}
                onCopy={() => {
                  void copyUrl();
                }}
              />
              {!sheet && <LinkRouteOpenActions response={response} />}
              {message && (
                <p role="status" className="text-meta text-muted-foreground">
                  {message}
                </p>
              )}
              {error && confirmation !== 'delete' && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={query.isFetching || mutation.isPending}
                onClick={() => {
                  void query.refetch();
                }}
              >
                정보 새로고침
              </Button>
            </form>
          )}
        </AppSheetContent>
        {response && (
          <AppSheetFooter>
            {editing ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={mutation.isPending}
                  onClick={() => requestExit('cancel')}
                >
                  취소
                </Button>
                <Button
                  form="link-edit-form"
                  type="submit"
                  loading={mutation.isPending}
                  disabled={!editor.dirty}
                >
                  변경 저장
                </Button>
              </>
            ) : (
              <>
                <Button
                  ref={deleteButton}
                  type="button"
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setError(null);
                    setDeleteSnapshot(response);
                    confirmationKind.current = 'delete';
                    confirmTrigger.current = deleteButton.current;
                    setConfirmation('delete');
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  삭제
                </Button>
                <Button
                  ref={editButton}
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setError(null);
                    setMessage('');
                    editor.begin(response);
                    requestAnimationFrame(() => nameInput.current?.focus());
                  }}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                  정보 수정
                </Button>
              </>
            )}
          </AppSheetFooter>
        )}
      </div>
      <ConfirmDialog
        open={confirmation !== null && (confirmation !== 'delete' || !denied)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmation(null);
            setDeleteSnapshot(null);
          }
        }}
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
        pending={mutation.isPending}
        error={confirmation === 'delete' ? error : undefined}
        onConfirm={() => {
          if (confirmation === 'delete') return remove();
          if (confirmation === 'close') finishClose();
          else finishEditing();
          return true;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (leaving.current) return;
          const target =
            confirmationKind.current === 'delete'
              ? deleteButton.current
              : !editing
                ? editButton.current
                : confirmTrigger.current;
          if (target?.isConnected && !target.matches(':disabled'))
            target.focus({ preventScroll: true });
          else
            (
              nameInput.current ??
              deleteButton.current ??
              editButton.current
            )?.focus({ preventScroll: true });
        }}
      />
    </>
  );
  return sheet ? (
    <AppSheet
      open
      busy={mutation.isPending}
      onOpenChange={(open) => {
        if (!open) requestExit('close');
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocus?.()?.focus({ preventScroll: true });
      }}
    >
      {content}
    </AppSheet>
  ) : (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">{content}</div>
  );
}

function LinkDetailContent({
  response,
  editor,
  nameInput,
  categories,
  stats,
  timeZone,
  today,
  busy,
  onCopy,
}: {
  response: LinkResponse;
  editor: ReturnType<typeof useLinkEditor>;
  nameInput: RefObject<HTMLInputElement | null>;
  categories: ReturnType<typeof useCategories>;
  stats: ReturnType<typeof useLinkStats>;
  timeZone: string;
  today: string | null;
  busy: boolean;
  onCopy: () => void;
}) {
  const draft = editor.draft;
  const category = categories.data?.find(
    (item) => item.id === response.categoryId,
  );
  return (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <LinkFavicon key={response.faviconUrl} src={response.faviconUrl} />
        <div className="min-w-0 flex-1 space-y-2">
          {draft ? (
            <div className="space-y-2">
              <label htmlFor="edit-title">제목</label>
              <Input
                ref={nameInput}
                id="edit-title"
                value={draft.title}
                maxLength={200}
                disabled={busy}
                onChange={(event) => editor.update('title', event.target.value)}
              />
            </div>
          ) : (
            <h1 className="break-words text-[26px] leading-snug font-semibold tracking-tight [overflow-wrap:anywhere]">
              {response.title}
            </h1>
          )}
          <p className="break-all text-sm text-muted-foreground">
            {response.domain}
          </p>
        </div>
      </div>
      <section className="space-y-2" aria-label="URL">
        <p
          className="select-all break-all text-sm leading-6 text-muted-foreground"
          aria-label="링크 URL"
        >
          {response.url}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
          <Copy aria-hidden="true" className="size-4" />
          URL 복사
        </Button>
      </section>
      <div className="space-y-2">
        {draft ? (
          <>
            <label htmlFor="edit-category">카테고리</label>
            <select
              id="edit-category"
              className="field-control"
              value={draft.category}
              disabled={busy || categories.status !== 'success'}
              onChange={(event) =>
                editor.update('category', event.target.value)
              }
            >
              <option value="">미분류</option>
              {draft.initial.categoryId &&
                !categories.data?.some(
                  (item) => item.id === draft.initial.categoryId,
                ) && (
                  <option value={draft.initial.categoryId}>
                    현재 카테고리
                  </option>
                )}
              {categories.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <p className="text-meta text-muted-foreground">카테고리</p>
            <p className="break-words">
              {category?.name ??
                (response.categoryId
                  ? categories.isError
                    ? '카테고리 조회 실패'
                    : '카테고리 확인 중'
                  : '미분류')}
            </p>
          </>
        )}
        {categories.isPending && (
          <p role="status" className="text-meta text-muted-foreground">
            카테고리를 불러오고 있어요.
          </p>
        )}
        {categories.error && (
          <RequestError
            text="카테고리를 확인하지 못했어요."
            retry={() => {
              void categories.refetch();
            }}
          />
        )}
      </div>
      {draft ? (
        <div className="space-y-2">
          <label htmlFor="edit-description">설명</label>
          <Textarea
            id="edit-description"
            value={draft.description}
            maxLength={2000}
            disabled={busy}
            onChange={(event) =>
              editor.update('description', event.target.value)
            }
          />
        </div>
      ) : (
        response.description && (
          <p className="whitespace-pre-wrap break-words leading-6 text-muted-foreground [overflow-wrap:anywhere]">
            {response.description}
          </p>
        )
      )}
      <dl className="space-y-4 border-y py-5 leading-6">
        <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
          <dt className="text-muted-foreground">등록일</dt>
          <dd>
            {dateInZone(
              stats.data?.createdAt ?? response.createdAt,
              timeZone,
            ).replaceAll('-', '.')}
          </dd>
        </div>
        <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
          <dt className="text-muted-foreground">최근 사용</dt>
          <dd>
            {usageDateLabel(
              stats.isSuccess && stats.data.periodEndDate === today
                ? stats.data.lastOpenedAt
                : response.lastOpenedAt,
              today,
              timeZone,
            )}
          </dd>
        </div>
      </dl>
      <LinkUsage stats={stats} today={today} />
    </>
  );
}

// Direct bookmarks retain the existing explicit open controls; the list Sheet has none.
function LinkRouteOpenActions({ response }: { response: LinkResponse }) {
  const opening = useLinkOpen();
  const link = linkView(response);
  return (
    <>
      <ExternalLink
        link={link}
        label="링크 열기"
        onActivate={opening.activate}
        busy={opening.state?.pending}
        className={buttonVariants()}
      >
        링크 열기 <ArrowUpRight aria-hidden="true" className="size-4" />
      </ExternalLink>
      <ExternalLink
        link={link}
        label="새 탭에서 열기"
        newTab
        onActivate={opening.activate}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        새 탭에서 열기 <ArrowUpRight aria-hidden="true" className="size-4" />
      </ExternalLink>
      <LinkOpenFeedback opening={opening} />
    </>
  );
}
