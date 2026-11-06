'use client';
import { useEffect, useRef, useState } from 'react';
import { useLinkMutation } from '@/lib/query/product';
import { useRequestScope } from '@/lib/query/provider';
import { ApiRequestError } from '@/lib/api/client';
import { LinkApiError } from '@/lib/api/links';
import { safeExternalUrl } from '@/lib/url';
import type { OpenActivation, OpenTarget } from './components/external-link';
import {
  useIncognito,
  isIncognitoActive,
} from '@/features/link-launch/provider';

type OpenState = {
  link: OpenTarget;
  pending: boolean;
  error?: string;
  canContinue: boolean;
  incognito?: boolean;
};
export function useLinkOpen() {
  const mutation = useLinkMutation();
  const { controller: launcher } = useIncognito();
  const secretBusy = useRef(false);
  const scope = useRequestScope();
  const [state, setState] = useState<OpenState | null>(null);
  const sequence = useRef(0);
  const active = useRef<AbortController | null>(null);
  const attempts = useRef(new Set<AbortController>());
  useEffect(() => {
    const requests = attempts.current;
    const leave = () => {
      sequence.current++;
      active.current?.abort();
      setState(null);
    };
    const internalNavigation = (event: MouseEvent) => {
      if (
        !event.isTrusted ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        anchor.hasAttribute('data-external-link')
      )
        return;
      if (new URL(anchor.href).origin === window.location.origin) leave();
    };
    // A Next transition can still be rendering when a record response arrives.
    // Respect the user's navigation intent before the old screen unmounts.
    document.addEventListener('click', internalNavigation, true);
    window.addEventListener('popstate', leave);
    return () => {
      document.removeEventListener('click', internalNavigation, true);
      window.removeEventListener('popstate', leave);
      for (const request of requests) request.abort();
      requests.clear();
    };
  }, []);
  const activate: OpenActivation = (link, mode) => {
    const safe = safeExternalUrl(link.url);
    if (!safe || scope().aborted) return;
    if (launcher && isIncognitoActive(launcher)) {
      if (secretBusy.current) return;
      secretBusy.current = true;
      const ticket = ++sequence.current;
      const controller = new AbortController();
      attempts.current.add(controller);
      const signal = AbortSignal.any([scope(), controller.signal]);
      setState({ link, pending: true, canContinue: false, incognito: true });
      void (async () => {
        let opened = false;
        try {
          await launcher.execute([safe.href], signal);
          if (signal.aborted) return;
          opened = true;
          await mutation.mutateAsync({ type: 'open', id: link.id, signal });
          if (ticket === sequence.current && !signal.aborted) setState(null);
        } catch (error) {
          if (ticket === sequence.current && !signal.aborted)
            setState({
              link,
              pending: false,
              canContinue: false,
              incognito: true,
              error: opened
                ? '시크릿 창은 열렸지만 사용 기록 저장 여부를 확인할 수 없어요. 창을 다시 열지 않아요.'
                : error instanceof Error
                  ? error.message
                  : '시크릿 실행 결과를 확인할 수 없어요. 자동으로 다시 열지 않아요.',
            });
        } finally {
          secretBusy.current = false;
          attempts.current.delete(controller);
        }
      })();
      return;
    }
    const ticket = ++sequence.current;
    const controller = new AbortController();
    attempts.current.add(controller);
    active.current = controller;
    const deadline = AbortSignal.timeout(5000);
    const signal = AbortSignal.any([scope(), controller.signal, deadline]);
    setState({ link, pending: mode === 'current', canContinue: false });
    // Superseding an intent suppresses its navigation, not its independent record.
    const aborted = new Promise<never>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () =>
          reject(new ApiRequestError(deadline.aborted ? 'timeout' : 'aborted')),
        { once: true },
      );
    });
    void (async () => {
      try {
        await Promise.race([
          mutation.mutateAsync({ type: 'open', id: link.id, signal }),
          aborted,
        ]);
        if (ticket !== sequence.current || signal.aborted) return;
        setState(null);
        // Navigate only to the already inspected href, never a substituted response URL.
        if (mode === 'current') {
          // A programmatic current-tab anchor preserves the no-referrer policy;
          // location.assign would instead use the document's referrer policy.
          const anchor = document.createElement('a');
          anchor.href = safe.href;
          anchor.rel = 'noopener noreferrer';
          anchor.referrerPolicy = 'no-referrer';
          document.body.append(anchor);
          anchor.click();
          anchor.remove();
        }
      } catch (reason) {
        if (
          ticket !== sequence.current ||
          scope().aborted ||
          controller.signal.aborted
        )
          return;
        const unknown =
          reason instanceof ApiRequestError &&
          ['network', 'timeout', 'invalid'].includes(reason.kind);
        const detail =
          reason instanceof ApiRequestError
            ? reason.kind === 'unauthorized'
              ? ' 다시 로그인해 주세요.'
              : reason.kind === 'forbidden'
                ? ' 접근 권한이 없어요.'
                : reason.kind === 'timeout'
                  ? ' 응답 시간이 초과됐어요.'
                  : ''
            : reason instanceof LinkApiError && reason.status === 404
              ? ' 링크를 찾을 수 없어요.'
              : '';
        setState({
          link,
          pending: false,
          canContinue: mode === 'current',
          error: `${unknown ? '사용 기록 저장 여부를 확인할 수 없어요.' : '사용 기록을 저장하지 못했어요.'}${detail}`,
        });
      } finally {
        attempts.current.delete(controller);
      }
    })();
  };
  function cancel() {
    sequence.current++;
    active.current?.abort();
    setState(null);
  }
  return { activate, state, cancel };
}
