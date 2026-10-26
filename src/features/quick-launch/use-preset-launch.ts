'use client';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { useRequestScope } from '@/lib/query/provider';
import { createClient } from '@/lib/supabase/client';
import { openLink } from '@/lib/api/links';
import { safeExternalUrl } from '@/lib/url';
import { queryKeys } from '@/lib/query/keys';
import { markUsageSummaryStale } from '@/lib/query/usage-summary';
import { markOrganizationReportsStale } from '@/lib/query/organization';
import type { LinkResponse } from '@/contracts/links';
type Result = {
  link: LinkResponse;
  attempted: boolean;
  record: 'pending' | 'saved' | 'unverified' | 'skipped';
};
export function usePresetLaunch() {
  const { user } = useAuth(),
    cache = useQueryClient(),
    scope = useRequestScope();
  const [results, setResults] = useState<Result[]>([]);
  const [locked, setLocked] = useState(false);
  const lock = useRef(0),
    generation = useRef(0),
    local = useRef(new AbortController());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    local.current = new AbortController();
    return () => {
      local.current.abort();
      clearTimeout(timer.current);
    };
  }, []);
  function record(link: LinkResponse, ticket: number) {
    const signal = AbortSignal.any([scope(), local.current.signal]);
    void openLink(createClient(), user.id, link.id, signal, false)
      .then(() => {
        if (signal.aborted) return;
        markOrganizationReportsStale(cache, user.id);
        markUsageSummaryStale(cache, user.id);
        for (const key of [
          queryKeys.stats(user.id, link.id),
          queryKeys.detail(user.id, link.id),
          queryKeys.lists(user.id),
          queryKeys.cleanup(user.id),
        ])
          void cache.invalidateQueries({ queryKey: key });
        if (ticket === generation.current)
          setResults((rows) =>
            rows.map((row) =>
              row.link.id === link.id ? { ...row, record: 'saved' } : row,
            ),
          );
      })
      .catch(() => {
        if (!signal.aborted && ticket === generation.current)
          setResults((rows) =>
            rows.map((row) =>
              row.link.id === link.id ? { ...row, record: 'unverified' } : row,
            ),
          );
      });
  }
  function launch(links: LinkResponse[]) {
    if (
      Date.now() < lock.current ||
      scope().aborted ||
      local.current.signal.aborted
    )
      return;
    lock.current = Date.now() + 1000;
    setLocked(true);
    timer.current = setTimeout(() => setLocked(false), 1000);
    const ticket = ++generation.current;
    const rows: Result[] = links.map((link) => {
      const safe = safeExternalUrl(link.url);
      if (!safe) return { link, attempted: false, record: 'skipped' };
      try {
        // null is also a normal noopener return; it does not prove popup blocking.
        window.open(safe.href, '_blank', 'noopener,noreferrer');
        return { link, attempted: true, record: 'pending' };
      } catch {
        return { link, attempted: false, record: 'skipped' };
      }
    });
    setResults(rows);
    rows
      .filter((row) => row.attempted)
      .forEach((row) => record(row.link, ticket));
  }
  function recordIndividual(link: LinkResponse) {
    if (!safeExternalUrl(link.url) || scope().aborted) return;
    record(link, generation.current);
  }
  return { results, locked, launch, recordIndividual };
}
