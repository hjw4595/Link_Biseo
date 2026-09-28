'use client';
import Link from 'next/link';
import { useId, useRef, useState, type RefObject } from 'react';
import { Archive, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RequestError } from '@/components/common/request-error';
import { useCleanup, usePreferences } from '@/lib/query/cleanup';
import { useLinkMutation } from '@/lib/query/product';
import { linkErrorMessage } from '@/lib/api/links';
import { useDeviceDay } from '../use-device-day';
import { LinkFavicon } from './link-favicon';
import { DeleteLinkDialog } from './delete-link-dialog';
export function CleanupNotice({
  fallbackFocus,
}: {
  fallbackFocus: RefObject<HTMLElement | null>;
}) {
  const prefs = usePreferences(),
    day = useDeviceDay();
  const query = useCleanup(day, prefs.data?.cleanupThresholdDays);
  const mutation = useLinkMutation();
  const [expanded, setExpanded] = useState(false),
    [target, setTarget] = useState<string | null>(null),
    [message, setMessage] = useState('');
  const busy = useRef(false),
    trigger = useRef<HTMLButtonElement>(null),
    panelId = useId();
  const first = query.data?.pages[0];
  const visible =
    prefs.data?.cleanupThresholdDays !== null && !!first?.totalCount;
  async function remove() {
    if (!target || busy.current) return false;
    busy.current = true;
    try {
      await mutation.mutateAsync({ type: 'delete', id: target });
      setMessage('링크를 삭제했어요.');
      setTarget(null);
      return true;
    } catch {
      return false; // Retain the candidate and mutation error.
    } finally {
      busy.current = false;
    }
  }
  if (prefs.error || (prefs.data?.cleanupThresholdDays !== null && query.error))
    return (
      <RequestError
        text="정리 안내를 불러오지 못했어요."
        retry={() => {
          if (prefs.error) void prefs.refetch();
          else void query.refetch();
        }}
      />
    );
  if (!visible && !target && !message) return null;
  return (
    <>
      {visible && (
        <section
          className="surface-card overflow-hidden"
          aria-label="미사용 링크 정리"
        >
          <button
            ref={trigger}
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded(!expanded)}
            className="flex min-h-16 w-full items-center gap-3 p-4 text-left"
          >
            <Archive
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                정리할 링크가 {first?.totalCount}개 있어요
              </span>
              <span className="block text-meta text-muted-foreground">
                최근 {first?.thresholdDays}일 이상 사용하지 않은 링크
              </span>
            </span>
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          <div
            id={panelId}
            hidden={!expanded}
            className="max-h-80 overflow-y-auto border-t px-3"
          >
            {query.data?.pages
              .flatMap((page) => page.items)
              .filter(
                (item, index, all) =>
                  all.findIndex((other) => other.id === item.id) === index,
              )
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 border-b last:border-0"
                >
                  <Link
                    href={`/links/${item.id}`}
                    className="flex min-h-20 min-w-0 flex-1 items-center gap-3 py-3"
                  >
                    <LinkFavicon src={item.faviconUrl} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {item.title}
                      </span>
                      <span className="block truncate text-meta text-muted-foreground">
                        {item.domain} · {item.unusedDays}일 미사용
                      </span>
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${item.title} 삭제`}
                    onClick={() => {
                      mutation.reset();
                      setTarget(item.id);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            {query.hasNextPage && (
              <Button
                variant="ghost"
                className="my-2 w-full"
                loading={query.isFetchingNextPage}
                onClick={() => {
                  void query.fetchNextPage();
                }}
              >
                더 불러오기
              </Button>
            )}
          </div>
        </section>
      )}
      <p role="status" className="sr-only">
        {message}
      </p>
      <DeleteLinkDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={remove}
        busy={mutation.isPending}
        error={mutation.error ? linkErrorMessage(mutation.error) : undefined}
        returnFocus={visible ? trigger : fallbackFocus}
      />
    </>
  );
}
