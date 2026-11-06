'use client';
import { Zap } from 'lucide-react';
import { LinkRegistrationLink } from '@/features/links/components/link-registration';
import { useRef, useState, type RefObject } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  AppSheet,
  AppSheetContent,
  AppSheetHeader,
} from '@/components/common/app-sheet';
import { RequestError } from '@/components/common/request-error';
import { usePresets, usePreset } from '@/lib/query/quick-launch';
import { presetErrorMessage } from '@/lib/api/quick-launch';
import type { PresetDetail, PresetSummary } from '@/contracts/quick-launch';
import { PresetReorder } from './preset-reorder';
import { PresetEditor } from './preset-editor';
import { PresetCard } from './preset-card';
import { useDesktopHome } from './use-desktop-home';
import { SectionHeader } from '@/components/common/section-header';
import { ContentSkeleton } from '@/components/common/content-skeleton';

function ExistingEditor({
  id,
  close,
  closeRequestRef,
}: {
  id: string;
  close: (message?: string) => void;
  closeRequestRef: RefObject<(() => void) | null>;
}) {
  const detail = usePreset(id, true);
  const [snapshot, setSnapshot] = useState<PresetDetail | null>(null);
  if (!snapshot && detail.isSuccess && !detail.isFetching)
    setSnapshot(detail.data);
  if (!snapshot && (detail.isPending || detail.isFetching))
    return (
      <AppSheetContent>
        <ContentSkeleton
          text="빠른 실행을 불러오고 있어요."
          variant="form"
          count={3}
        />
      </AppSheetContent>
    );
  if (!snapshot)
    return (
      <AppSheetContent>
        <RequestError
          text={presetErrorMessage(detail.error)}
          retry={() => {
            void detail.refetch();
          }}
        />
      </AppSheetContent>
    );
  return (
    <PresetEditor
      preset={snapshot}
      onClose={close}
      closeRequestRef={closeRequestRef}
    />
  );
}

export function QuickLaunch() {
  const desktop = useDesktopHome();
  const closeRequestRef = useRef<(() => void) | null>(null);
  const list = usePresets(desktop);
  const [reordering, setReordering] = useState<PresetSummary[] | null>(null);
  const reorderTrigger = useRef<HTMLButtonElement>(null);
  const [editor, setEditor] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  function closeEditor(message?: string) {
    setEditor(null);
    if (message) setMessage(message);
  }
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const writes = useIsMutating({ mutationKey: ['preset-write'] });
  const items =
    list.data?.items.toSorted((a, b) => a.sortOrder - b.sortOrder) ?? [];
  if (expanded && list.isSuccess && !items.some((item) => item.id === expanded))
    setExpanded(null);
  const visible = showAll ? items : items.slice(0, 6);
  function closeReorder() {
    setReordering(null);
    requestAnimationFrame(() => {
      (reorderTrigger.current?.getClientRects().length
        ? reorderTrigger.current
        : document.getElementById('home-title')
      )?.focus();
    });
  }
  return (
    <>
      {(desktop || reordering) && (
        <section
          hidden={!desktop}
          aria-labelledby="quick-launch-heading"
          className="space-y-3"
        >
          <SectionHeader
            id="quick-launch-heading"
            title={
              reordering ? (
                '순서 변경'
              ) : (
                <span className="flex items-center gap-2">
                  <Zap className="size-5" aria-hidden="true" />
                  빠른 실행
                </span>
              )
            }
            headingRef={heading}
            focusable
            action={
              !reordering &&
              !list.isPending &&
              !list.error && (
                <div className="flex gap-2">
                  {items.length > 0 && (
                    <Button
                      ref={reorderTrigger}
                      variant="ghost"
                      onClick={() => {
                        setMessage('');
                        setReordering(items);
                        requestAnimationFrame(() => heading.current?.focus());
                      }}
                    >
                      순서 변경
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={items.length >= 50}
                    onClick={(e) => {
                      trigger.current = e.currentTarget;
                      setMessage('');
                      setEditor('new');
                    }}
                  >
                    빠른 실행 추가
                  </Button>
                </div>
              )
            }
          />
          {reordering ? (
            <PresetReorder
              initial={reordering}
              current={items}
              onClose={closeReorder}
            />
          ) : list.isPending ? (
            <p role="status">빠른 실행을 불러오고 있어요.</p>
          ) : list.error ? (
            <RequestError
              text={presetErrorMessage(list.error, true)}
              retry={() => {
                void list.refetch();
              }}
            />
          ) : (
            <>
              {!items.length && (
                <div className="surface-card space-y-2 p-4">
                  <p className="text-muted-foreground">
                    아직 빠른 실행이 없어요.
                  </p>
                  <p className="text-meta text-muted-foreground">
                    자주 사용하는 링크를 빠른 실행에 추가해 보세요.
                  </p>
                  <LinkRegistrationLink
                    href="/links/new"
                    className="inline-flex min-h-11 items-center text-meta text-accent hover:underline"
                  >
                    링크 추가하기
                  </LinkRegistrationLink>
                </div>
              )}
              {items.length >= 50 && (
                <p role="status">빠른 실행은 최대 50개까지 추가할 수 있어요.</p>
              )}
              <ul
                aria-label="빠른 실행 목록"
                className="grid grid-cols-2 items-start gap-3"
              >
                {visible.map((preset, index) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    preload={index < 6}
                    expanded={expanded === preset.id}
                    toggle={() =>
                      setExpanded(expanded === preset.id ? null : preset.id)
                    }
                    reveal={() => setExpanded(preset.id)}
                    edit={(button) => {
                      trigger.current = button;
                      setMessage('');
                      setEditor(preset.id);
                    }}
                  />
                ))}
              </ul>
              {items.length > 6 && (
                <Button
                  ref={moreButton}
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    if (showAll) {
                      if (
                        !items.slice(0, 6).some((item) => item.id === expanded)
                      )
                        setExpanded(null);
                      moreButton.current?.focus();
                    }
                    setShowAll(!showAll);
                  }}
                >
                  {showAll ? '목록 접기' : `나머지 ${items.length - 6}개 보기`}
                </Button>
              )}
            </>
          )}
          <p role="status" className={message ? 'text-meta' : 'sr-only'}>
            {message}
          </p>
        </section>
      )}
      <AppSheet
        open={editor !== null}
        busy={writes > 0}
        onOpenChange={(open) => {
          if (!open && writes === 0) {
            if (closeRequestRef.current) closeRequestRef.current();
            else setEditor(null);
          }
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          (trigger.current?.isConnected &&
          trigger.current.getClientRects().length
            ? trigger.current
            : desktop
              ? heading.current
              : document.getElementById('home-title')
          )?.focus();
        }}
      >
        <AppSheetHeader
          title={editor === 'new' ? '빠른 실행 추가' : '빠른 실행 편집'}
        />
        {editor === 'new' ? (
          <PresetEditor
            onClose={closeEditor}
            closeRequestRef={closeRequestRef}
          />
        ) : (
          editor && (
            <ExistingEditor
              key={editor}
              closeRequestRef={closeRequestRef}
              id={editor}
              close={closeEditor}
            />
          )
        )}
      </AppSheet>
    </>
  );
}
