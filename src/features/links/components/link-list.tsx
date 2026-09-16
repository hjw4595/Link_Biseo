'use client';
import type { LinkView } from '../types';
import { EmptyState } from '@/components/common/empty-state';
import { LinkItem } from './link-item';
import { useRef, useState, type ReactNode } from 'react';
import { LinkDetailSheet } from './link-detail';
import type { OpenActivation } from './external-link';

export function LinkList({
  links,
  emptyAction,
  emptyTitle = '아직 링크가 없어요',
  emptyDescription = '새 링크를 추가하거나 다른 필터를 선택해보세요.',
  onFavorite,
  busy = false,
  onOpen,
  openingId,
  feedbackId,
  openFeedback,
  grid = false,
  managementCategories,
  categoryStatus = 'success',
  home = false,
  compact = false,
  onDetail,
}: {
  links: readonly LinkView[];
  emptyAction?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  onFavorite?: (link: LinkView) => void | Promise<void>;
  busy?: boolean;
  onOpen?: OpenActivation;
  openingId?: string;
  feedbackId?: string;
  openFeedback?: ReactNode;
  grid?: boolean;
  managementCategories?: readonly { id: string; name: string }[];
  categoryStatus?: 'pending' | 'success' | 'error';
  home?: boolean;
  compact?: boolean;
  onDetail?: (id: string, opener: HTMLButtonElement) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  return (
    <div ref={root} tabIndex={-1} aria-label="저장한 링크 목록">
      {!links.length ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          compact={home}
        />
      ) : (
        <ul
          className={
            compact && !home
              ? 'flex min-w-0 flex-col divide-y divide-border'
              : grid
                ? 'grid min-w-0 grid-cols-1 gap-x-6 gap-y-1 lg:grid-cols-2'
                : 'flex min-w-0 flex-col gap-1'
          }
          aria-label="링크 목록"
        >
          {links.map((link) => (
            <li key={link.id} className="min-w-0">
              <LinkItem
                compact={compact}
                home={home}
                link={link}
                onDetail={(id, opener) => {
                  if (onDetail) onDetail(id, opener);
                  else {
                    trigger.current = opener;
                    setSelected(id);
                  }
                }}
                onFavorite={onFavorite}
                busy={busy}
                onOpen={onOpen}
                opening={openingId === link.id}
                categoryLabel={
                  managementCategories === undefined
                    ? undefined
                    : link.categoryId
                      ? categoryStatus === 'error'
                        ? '카테고리 조회 실패'
                        : categoryStatus === 'pending'
                          ? '카테고리 확인 중'
                          : (managementCategories.find(
                              (category) => category.id === link.categoryId,
                            )?.name ?? '카테고리 정보 없음')
                      : '미분류'
                }
              />
              {feedbackId === link.id && openFeedback}
            </li>
          ))}
        </ul>
      )}
      {!links.some((link) => link.id === feedbackId) && openFeedback}
      {!onDetail && selected && (
        <LinkDetailSheet
          id={selected}
          onClose={() => setSelected(null)}
          returnFocus={() => {
            if (
              trigger.current?.isConnected &&
              trigger.current.getClientRects().length
            )
              return trigger.current;
            return (
              root.current?.querySelector<HTMLElement>('[data-link-detail]') ??
              root.current
            );
          }}
        />
      )}
    </div>
  );
}
