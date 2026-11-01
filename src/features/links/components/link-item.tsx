'use client';
import { ChevronRight, Star, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import type { LinkView } from '../types';
import { LinkFavicon } from './link-favicon';
import { ExternalLink, type OpenActivation } from './external-link';

export function LinkItem({
  link,
  onFavorite,
  busy = false,
  onOpen,
  opening = false,
  categoryLabel,
  home = false,
  onDetail,
  compact = false,
}: {
  link: LinkView;
  onFavorite?: (link: LinkView) => void | Promise<void>;
  busy?: boolean;
  onOpen?: OpenActivation;
  opening?: boolean;
  categoryLabel?: string;
  home?: boolean;
  onDetail?: (id: string, trigger: HTMLButtonElement) => void;
  compact?: boolean;
}) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const pending = useRef(false);
  const favorite = optimistic ?? link.favorite;
  async function toggleFavorite() {
    if (!onFavorite || pending.current) return;
    pending.current = true;
    setOptimistic(!link.favorite);
    try {
      await onFavorite(link);
    } catch {
      /* The feature owns request-error feedback. Authoritative props restore below. */
    } finally {
      pending.current = false;
      setOptimistic(null);
    }
  }
  return (
    <div
      className={
        compact && !home
          ? 'flex min-h-14 min-w-0 items-center gap-1 px-1 py-1.5 hover:bg-surface'
          : 'flex min-h-16 min-w-0 items-center gap-1 rounded-sm px-1 py-2 hover:bg-surface'
      }
      data-testid="link-item"
    >
      <ExternalLink
        link={link}
        onActivate={onOpen}
        busy={opening}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-sm sm:gap-3"
      >
        {!compact && <LinkFavicon key={link.favicon} src={link.favicon} />}
        <span className="min-w-0 flex-1">
          <span
            className={
              home && !compact
                ? 'line-clamp-2 text-list font-medium [overflow-wrap:anywhere]'
                : 'block truncate text-list font-medium'
            }
            title={link.title}
          >
            {link.title}
          </span>
          {!compact && (
            <span
              className="mt-1 block truncate text-meta text-muted-foreground"
              title={
                categoryLabel
                  ? `${link.domain} · ${categoryLabel}`
                  : link.domain
              }
            >
              {link.domain}
              {categoryLabel !== undefined && (
                <>
                  {' · '}
                  <span>{categoryLabel}</span>
                </>
              )}
            </span>
          )}
        </span>
        {opening && (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
          />
        )}
      </ExternalLink>
      <button
        type="button"
        aria-label={`${link.title} 즐겨찾기`}
        aria-pressed={favorite}
        onClick={() => {
          void toggleFavorite();
        }}
        disabled={busy || optimistic !== null || !onFavorite}
        className="flex size-11 shrink-0 items-center justify-center rounded-sm hover:bg-surface-raised disabled:cursor-wait"
      >
        <Star
          aria-hidden="true"
          className={`size-6 ${favorite ? 'text-favorite' : 'text-muted-foreground'}`}
          fill={favorite ? 'currentColor' : 'none'}
        />
      </button>
      <button
        type="button"
        onClick={(event) => onDetail?.(link.id, event.currentTarget)}
        className="flex min-h-11 shrink-0 items-center gap-0.5 rounded-sm px-1 text-meta text-muted-foreground hover:bg-surface-raised hover:text-foreground sm:px-2"
        aria-label={`${link.title} 상세 보기`}
        data-link-detail=""
      >
        상세 <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
