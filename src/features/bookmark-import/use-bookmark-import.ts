'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/auth-provider';
import { useRequestScope } from '@/lib/query/provider';
import { createClient } from '@/lib/supabase/client';
import { linkErrorMessage, listLinks } from '@/lib/api/links';
import {
  bookmarkFileMessage,
  parseBookmarkHtml,
  readBookmarkFile,
} from './parser/parse-bookmark-html';
import {
  buildImportItems,
  compareExisting,
} from './utils/detect-import-duplicates';
import { ExistingScanError, scanExistingLinks } from './scan-existing-links';
import { MAX_SELECTION, type ExistingScan, type ImportItem } from './types';

interface PreviewState {
  phase: 'idle' | 'parsing' | 'reviewing';
  fileName: string;
  items: ImportItem[];
  scan: ExistingScan;
  error: string | null;
  selected: Set<string>;
}
const emptyState = (): PreviewState => ({
  phase: 'idle',
  fileName: '',
  items: [],
  scan: { status: 'idle' },
  error: null,
  selected: new Set(),
});

export function useBookmarkImport() {
  const { user } = useAuth();
  const scope = useRequestScope();
  const [state, setState] = useState<PreviewState>(emptyState);
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const current = useRef<AbortController | null>(null);
  const baseItems = useRef<ImportItem[]>([]);
  useEffect(() => {
    let mounted = true;
    // Do not accept file events until account-scope effects (including development
    // StrictMode teardown/recreation) have completed for this committed screen.
    queueMicrotask(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
      current.current?.abort();
      baseItems.current = [];
    };
  }, []);

  function begin() {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    const id = ++generation.current;
    const signal = AbortSignal.any([controller.signal, scope()]);
    return {
      id,
      signal,
      live: () => id === generation.current && !signal.aborted,
    };
  }

  async function compare(
    items: ImportItem[],
    run: ReturnType<typeof begin>,
    knownSaved = new Map<string, string>(),
    selectDefault = true,
  ) {
    try {
      const result = await scanExistingLinks(
        (cursor, signal) =>
          listLinks(
            createClient(),
            user.id,
            { sort: 'default', limit: 100 },
            cursor,
            signal,
          ),
        run.signal,
      );
      if (!run.live()) return;
      const compared = compareExisting(
        items,
        new Map([...result.index, ...knownSaved]),
      );
      setState((previous) => ({
        ...previous,
        items: compared,
        scan: { status: 'complete', ...result },
        selected: new Set(
          (selectDefault ? compared : [])
            .filter((item) => item.eligibility === 'ready')
            .slice(0, MAX_SELECTION)
            .map((item) => item.localId),
        ),
      }));
      return result.index;
    } catch (error) {
      if (!run.live()) return;
      const reason =
        error instanceof ExistingScanError
          ? {
              cursor: '목록의 다음 페이지를 확인할 수 없어요.',
              limit: '기존 링크 확인 범위(5,000개·50페이지)를 초과했어요.',
              invalid: '기존 링크 목록의 내용을 확인할 수 없어요.',
              timeout: '기존 링크 확인 시간(30초)을 초과했어요.',
            }[error.reason]
          : linkErrorMessage(error);
      setState((previous) => ({
        ...previous,
        scan: { status: 'incomplete', reason },
        selected: new Set(),
      }));
    }
  }

  async function selectFile(file: File) {
    if (!ready) return;
    const run = begin();
    baseItems.current = [];
    setState({ ...emptyState(), phase: 'parsing', fileName: file.name });
    try {
      const html = await readBookmarkFile(file);
      // Let the pending UI paint before synchronous inert tree construction.
      await new Promise<void>((resolve) => {
        // Background/throttled WebKit pages may not deliver an animation frame.
        // Yield for paint when possible, but never depend on a frame to proceed.
        const timer = setTimeout(done, 100);
        const frame = requestAnimationFrame(() => {
          setTimeout(done, 0);
        });
        function done() {
          clearTimeout(timer);
          cancelAnimationFrame(frame);
          resolve();
        }
      });
      if (!run.live()) return;
      const items = buildImportItems(parseBookmarkHtml(html, run.id));
      if (!run.live()) return;
      baseItems.current = items;
      setState({
        ...emptyState(),
        phase: 'reviewing',
        fileName: file.name,
        items,
        scan: { status: 'loading' },
      });
      await compare(items, run);
    } catch (error) {
      if (run.live())
        setState({
          ...emptyState(),
          fileName: file.name,
          error: bookmarkFileMessage(error),
        });
    }
  }

  function recheck(
    knownSaved = new Map<string, string>(),
    selectDefault = true,
  ) {
    const run = begin();
    const items = baseItems.current;
    setState((previous) => ({
      ...previous,
      items,
      selected: new Set(),
      scan: { status: 'loading' },
    }));
    return compare(items, run, knownSaved, selectDefault);
  }

  function select(localId: string, checked: boolean) {
    setState((previous) => {
      if (
        previous.scan.status !== 'complete' ||
        !previous.items.some(
          (item) => item.localId === localId && item.eligibility === 'ready',
        )
      )
        return previous;
      const selected = new Set(previous.selected);
      if (!checked) selected.delete(localId);
      else if (selected.size < MAX_SELECTION) selected.add(localId);
      return { ...previous, selected };
    });
  }

  function selectAll(checked: boolean) {
    setState((previous) => ({
      ...previous,
      selected: new Set(
        checked && previous.scan.status === 'complete'
          ? previous.items
              .filter((item) => item.eligibility === 'ready')
              .slice(0, MAX_SELECTION)
              .map((item) => item.localId)
          : [],
      ),
    }));
  }

  return {
    ready,
    ...state,
    selectFile,
    recheck,
    select,
    selectAll,
    selectGroup: (ids: string[], checked: boolean) => {
      setState((previous) => {
        if (previous.scan.status !== 'complete') return previous;
        const selected = new Set(previous.selected);
        for (const id of ids) {
          if (!checked) selected.delete(id);
          else if (
            selected.size < MAX_SELECTION &&
            previous.items.some(
              (item) => item.localId === id && item.eligibility === 'ready',
            )
          )
            selected.add(id);
        }
        return { ...previous, selected };
      });
    },
    clear: () => {
      begin();
      baseItems.current = [];
      setState(emptyState());
    },
    isCurrent: (items: ImportItem[]) =>
      !current.current?.signal.aborted &&
      baseItems.current[0]?.localId === items[0]?.localId,
  };
}
