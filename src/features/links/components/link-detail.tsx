'use client';
import { TopBar } from '@/components/common/top-bar';
import { MissingResource } from '@/components/common/missing-resource';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { ContentSkeleton } from '@/components/common/content-skeleton';
import {
  AppSheet,
  AppSheetHeader,
  AppSheetContent,
  AppSheetFooter,
} from '@/components/common/app-sheet';
import { RequestError } from '@/components/common/request-error';
import {
  useLinkDetail,
  type LinkDetailOptions,
} from '../detail/use-link-detail';
import { LinkDetailContent } from '../detail/components/link-detail-content';
import { LinkRouteOpenActions } from '../detail/components/link-route-open-actions';
import { LinkDetailActions } from '../detail/components/link-detail-actions';
import { LinkDetailConfirmation } from '../detail/components/link-detail-confirmation';

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
function LinkDetailController(props: LinkDetailOptions) {
  const {
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
    busy,
    save,
    copyUrl,
    beginEditing,
    requestDelete,
    confirm,
  } = useLinkDetail(props);
  const {
    region: regionRef,
    nameInput: nameInputRef,
    editButton: editButtonRef,
    deleteButton: deleteButtonRef,
    confirmation,
    captureFocus,
    requestExit,
    restoreSheetFocus,
    changeConfirmation,
    restoreConfirmationFocus,
  } = interaction;
  if (!sheet && denied && missing) return <MissingResource kind="링크" />;
  const content = (
    <>
      <div
        ref={regionRef}
        className="flex min-h-0 flex-1 flex-col"
        onFocusCapture={captureFocus}
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
        <AppSheetContent
          className={sheet ? undefined : 'screen-content md:px-6'}
        >
          {!response ? (
            denied && missing ? (
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
              <ContentSkeleton
                text="링크를 불러오고 있어요."
                variant="detail"
              />
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
                nameInput={nameInputRef}
                categories={categories}
                stats={stats}
                timeZone={timeZone}
                today={today}
                busy={busy}
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
                disabled={query.isFetching || busy}
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
          <AppSheetFooter className={sheet ? undefined : 'md:px-6'}>
            <LinkDetailActions
              editing={editing}
              busy={busy}
              dirty={editor.dirty}
              editButton={editButtonRef}
              deleteButton={deleteButtonRef}
              onEdit={beginEditing}
              onDelete={requestDelete}
              onCancel={() => requestExit('cancel')}
            />
          </AppSheetFooter>
        )}
      </div>
      <LinkDetailConfirmation
        confirmation={confirmation}
        onOpenChange={changeConfirmation}
        onCloseAutoFocus={restoreConfirmationFocus}
        response={response}
        denied={denied}
        busy={busy}
        error={error}
        onConfirm={confirm}
      />
    </>
  );
  return sheet ? (
    <AppSheet
      open
      busy={busy}
      onOpenChange={(open) => {
        if (!open) requestExit('close');
      }}
      onCloseAutoFocus={restoreSheetFocus}
    >
      {content}
    </AppSheet>
  ) : (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">{content}</div>
  );
}
