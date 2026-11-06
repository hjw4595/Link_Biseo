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
import {
  useIncognito,
  isIncognitoActive,
} from '@/features/link-launch/provider';
type Result = {
  link: LinkResponse;
  attempted: boolean;
  record: 'pending' | 'saved' | 'unverified' | 'skipped';
};
export function usePresetLaunch() {
  const { controller: launcher, incognito } = useIncognito();
  const secretBusy = useRef(false);
  const [error, setError] = useState('');
  const [secretResult, setSecretResult] = useState(false);
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
    if (launcher && isIncognitoActive(launcher)) {
      if (secretBusy.current) return;
      secretBusy.current = true;
      setLocked(true);
      setError('');
      setSecretResult(true);
      setResults([]);
      const ticket = ++generation.current;
      const snapshot = [...links];
      const signal = AbortSignal.any([scope(), local.current.signal]);
      void (async () => {
        try {
          await launcher.execute(
            snapshot.map((link) => link.url),
            signal,
          );
          if (signal.aborted) return;
          setResults(
            snapshot.map((link) => ({
              link,
              attempted: true,
              record: 'pending',
            })),
          );
          snapshot.forEach((link) => record(link, ticket));
        } catch (reason) {
          if (!signal.aborted)
            setError(
              reason instanceof Error
                ? reason.message
                : '시크릿 실행 결과를 확인할 수 없어요.',
            );
        } finally {
          secretBusy.current = false;
          if (!signal.aborted) setLocked(false);
        }
      })();
      return;
    }
    setError('');
    setSecretResult(false);
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
    if (isIncognitoActive(launcher)) {
      launch([link]);
      return;
    }
    if (!safeExternalUrl(link.url) || scope().aborted) return;
    record(link, generation.current);
  }
  return {
    results,
    locked,
    launch,
    recordIndividual,
    error,
    incognito,
    secretResult,
  };
}
