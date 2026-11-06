'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createLaunchStore } from './store';
import {
  checkExtension,
  ExtensionError,
  openIncognitoUrls,
} from '@/lib/browser/biseo-extension';
import { useDesktopHome } from '@/features/quick-launch/use-desktop-home';
type Controller = {
  store: ReturnType<typeof createLaunchStore>;
  check: () => Promise<void>;
  off: () => void;
  execute: (urls: readonly string[], signal: AbortSignal) => Promise<void>;
};
const Context = createContext<Controller | null>(null);
export function LaunchProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createLaunchStore);
  const epoch = useRef(0),
    checking = useRef(false),
    opening = useRef(false);
  const alive = useRef(true),
    lifecycle = useRef(new AbortController());
  function off() {
    epoch.current++;
    checking.current = false;
    store.getState().reset();
  }
  useEffect(() => {
    const generation = epoch;
    alive.current = true;
    lifecycle.current = new AbortController();
    const media = window.matchMedia('(min-width: 1024px)');
    const reset = () => {
      if (!media.matches) {
        epoch.current++;
        checking.current = false;
        store.getState().reset();
      }
    };
    media.addEventListener('change', reset);
    reset();
    return () => {
      alive.current = false;
      lifecycle.current.abort();
      generation.current++;
      media.removeEventListener('change', reset);
    };
  }, [store]);
  async function check() {
    if (checking.current || !window.matchMedia('(min-width: 1024px)').matches)
      return;
    checking.current = true;
    const ticket = ++epoch.current;
    store.getState().update({
      mode: 'normal',
      extensionConnection: 'checking',
      incognitoPermission: 'unknown',
      notice: null,
    });
    try {
      const allowed = await checkExtension(lifecycle.current.signal);
      if (!alive.current || ticket !== epoch.current) return;
      store.getState().update({
        mode: allowed ? 'incognito' : 'normal',
        extensionConnection: 'connected',
        incognitoPermission: allowed ? 'allowed' : 'denied',
        notice: allowed ? null : '시크릿 모드 허용이 필요합니다.',
      });
    } catch (error) {
      if (!alive.current || ticket !== epoch.current) return;
      store.getState().update({
        mode: 'normal',
        extensionConnection:
          error instanceof ExtensionError && error.kind === 'unsupported'
            ? 'unsupported'
            : error instanceof ExtensionError &&
                ['transport', 'configuration'].includes(error.kind)
              ? 'unavailable'
              : 'error',
        incognitoPermission: 'unknown',
        notice:
          error instanceof Error
            ? error.message
            : 'Chrome 확장 프로그램을 연결할 수 없습니다.',
      });
    } finally {
      if (ticket === epoch.current) checking.current = false;
    }
  }
  async function execute(urls: readonly string[], signal: AbortSignal) {
    if (opening.current)
      throw new ExtensionError('busy', '시크릿 실행을 처리 중이에요.');
    if (!alive.current || signal.aborted)
      throw new ExtensionError('aborted', '실행이 취소됐어요.');
    opening.current = true;
    try {
      await openIncognitoUrls(
        urls,
        // Route teardown suppresses the caller's result, but does not release
        // the shared lock before the dispatched request settles or times out.
        lifecycle.current.signal,
      );
    } finally {
      opening.current = false;
    }
  }
  return (
    <Context.Provider value={{ store, check, off, execute }}>
      {children}
    </Context.Provider>
  );
}
export const useLaunch = () => useContext(Context);
export function isIncognitoActive(controller: Controller | null) {
  return (
    controller?.store.getState().mode === 'incognito' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 1024px)').matches
  );
}
const noopSubscribe = () => () => {};
const normal = () => 'normal' as const;
export function useIncognito() {
  const controller = useLaunch();
  const desktop = useDesktopHome();
  const mode = useSyncExternalStore(
    controller?.store.subscribe ?? noopSubscribe,
    controller ? () => controller.store.getState().mode : normal,
    normal,
  );
  return { controller, incognito: desktop && mode === 'incognito' };
}
