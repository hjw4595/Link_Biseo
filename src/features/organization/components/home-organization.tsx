'use client';
import Link from 'next/link';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import type { LinkResponse } from '@/contracts/links';
import { Button } from '@/components/ui/button';
import { RequestError } from '@/components/common/request-error';
import { DeleteLinkDialog } from '@/features/links/components/delete-link-dialog';
import { useLinkMutation } from '@/lib/query/product';
import { linkErrorMessage } from '@/lib/api/links';
import { organizationErrorMessage } from '@/lib/api/organization';
import { useOrganizationReport } from '../use-organization-report';
import { reportToCandidateLinks } from '../adapters/report-to-recommendations';

export function HomeOrganization({
  onDetail,
}: {
  onDetail: (id: string, opener: HTMLButtonElement) => void;
}) {
  const result = useOrganizationReport({ automatic: true });
  const mutation = useLinkMutation();
  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState<LinkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const candidates = result.data
    ? reportToCandidateLinks(result.data.report, result.data.removedLinkIds)
    : null;
  if (expanded && candidates && candidates.links.length === 0)
    setExpanded(false);
  function fallback() {
    return toggle.current ?? document.getElementById('home-title');
  }
  function closeDelete() {
    if (!returnFocus.current?.isConnected) returnFocus.current = fallback();
    setTarget(null);
    setError(null);
  }
  async function remove() {
    if (!target || pending.current) return false;
    pending.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({ type: 'delete', id: target.id });
      returnFocus.current = fallback();
      setTarget(null);
      return true;
    } catch (reason: unknown) {
      setError(linkErrorMessage(reason));
      return false;
    } finally {
      pending.current = false;
    }
  }
  return (
    <>
      {candidates && candidates.links.length > 0 && (
        <section
          aria-label="비서의 추천"
          className="min-w-0 overflow-hidden rounded-xl border bg-surface"
          aria-busy={result.pending}
        >
          <h2>
            <button
              ref={toggle}
              type="button"
              className="flex min-h-16 w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label="비서의 추천"
              aria-describedby="home-recommendation-count"
              aria-expanded={expanded}
              aria-controls="home-recommendation-links"
              onClick={() => setExpanded((value) => !value)}
            >
              <Sparkles
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-list font-semibold">
                  비서의 추천
                </span>
                <span
                  id="home-recommendation-count"
                  className="block text-meta text-muted-foreground"
                >
                  정리가 필요한 링크 {candidates.links.length}개
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          </h2>
          <div id="home-recommendation-links" hidden={!expanded}>
            {expanded && (
              <>
                <ul aria-label="추천 링크 목록" className="border-t px-3 py-2">
                  {candidates.links.map((link) => (
                    <li
                      key={link.id}
                      data-testid="recommendation-candidate"
                      className="flex min-w-0 items-center gap-2"
                    >
                      <button
                        type="button"
                        data-link-detail=""
                        className="min-h-11 min-w-0 flex-1 rounded-sm px-1 text-left text-list font-medium hover:text-accent"
                        aria-label={`${link.title} 상세 보기`}
                        onClick={(event) =>
                          onDetail(link.id, event.currentTarget)
                        }
                      >
                        <span className="block truncate" title={link.title}>
                          {link.title}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-destructive"
                        aria-label={`${link.title} 삭제`}
                        disabled={mutation.isPending}
                        onClick={(event) => {
                          returnFocus.current = event.currentTarget;
                          setError(null);
                          setTarget(link);
                        }}
                      >
                        삭제
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 px-4 pb-3 text-meta text-muted-foreground">
                  {candidates.truncated && (
                    <span>보고서에 포함된 일부 후보예요.</span>
                  )}
                  <Link
                    href="/assistant/organization"
                    prefetch={false}
                    className="ml-auto flex min-h-11 items-center hover:text-accent"
                  >
                    전체 보고서
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      )}
      {result.error && (
        <RequestError
          text={organizationErrorMessage(result.error)}
          retry={result.run}
        />
      )}
      <DeleteLinkDialog
        open={target !== null}
        onClose={closeDelete}
        onConfirm={remove}
        busy={mutation.isPending}
        error={error ?? undefined}
        returnFocus={returnFocus}
        confirmLabel="링크 삭제"
        title={target ? `'${target.title}'을 삭제할까요?` : undefined}
      />
    </>
  );
}
