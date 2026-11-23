'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigationGuard } from '@/components/common/navigation-guard';

type RegistrationExitOptions = {
  dirty: boolean;
  saving: boolean;
  pendingRef: RefObject<boolean>;
  completedRef: RefObject<boolean>;
  onExit: () => void;
  returnFocus?: RefObject<HTMLAnchorElement | null>;
};
export function useRegistrationExit({
  dirty,
  saving,
  pendingRef,
  completedRef,
  onExit,
  returnFocus,
}: RegistrationExitOptions) {
  const guard = useNavigationGuard();
  const [discardOpen, setDiscardOpen] = useState(false);
  const backButton = useRef<HTMLButtonElement>(null);
  const closeFocus = useRef<HTMLElement | null>(null);
  const live = useRef({ dirty, saving });
  useEffect(() => {
    live.current = { dirty, saving };
  }, [dirty, saving]);
  useEffect(() => {
    const allow = () =>
      completedRef.current ||
      (!live.current.saving &&
        (!live.current.dirty ||
          window.confirm('작성 중인 링크를 버리고 이동할까요?')));
    const unregister = guard.register(allow);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        !completedRef.current &&
        (live.current.dirty || live.current.saving)
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    let restoring = false;
    const navigation =
      'navigation' in window && window.navigation instanceof EventTarget
        ? window.navigation
        : null;
    const navigate = (event: Event) => {
      if (
        'navigationType' in event &&
        event.navigationType === 'traverse' &&
        event.cancelable &&
        !allow()
      )
        event.preventDefault();
    };
    navigation?.addEventListener('navigate', navigate);
    const pop = (event: PopStateEvent) => {
      if (navigation) return;
      if (restoring) {
        restoring = false;
        return;
      }
      if (!allow()) {
        event.stopImmediatePropagation();
        restoring = true;
        window.history.go(1);
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', pop, true);
    return () => {
      unregister();
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', pop, true);
      navigation?.removeEventListener('navigate', navigate);
    };
  }, [guard, completedRef]);
  function close() {
    completedRef.current = true;
    onExit();
  }
  function requestClose() {
    if (pendingRef.current || saving) return;
    if (discardOpen) {
      setDiscardOpen(false);
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[data-app-sheet]'))
      closeFocus.current = active;
    if (dirty) setDiscardOpen(true);
    else close();
  }
  function restoreTriggerFocus(event: Event) {
    if (!returnFocus) return;
    event.preventDefault();
    const fallback = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-link-registration-trigger], main a[href], main button:not([disabled])',
      ),
    ].find((node) => node.getClientRects().length);
    const target =
      returnFocus.current?.isConnected &&
      returnFocus.current.getClientRects().length
        ? returnFocus.current
        : fallback;
    target?.focus({ preventScroll: true });
  }
  function restoreDiscardFocus(event: Event) {
    event.preventDefault();
    if (!completedRef.current)
      (closeFocus.current?.isConnected
        ? closeFocus.current
        : backButton.current
      )?.focus({ preventScroll: true });
  }
  return {
    discardOpen,
    setDiscardOpen,
    backButton,
    close,
    requestClose,
    restoreTriggerFocus,
    restoreDiscardFocus,
    confirmDiscard() {
      close();
      return true;
    },
  };
}
