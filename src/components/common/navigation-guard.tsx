'use client';
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const Context = createContext({
  register:
    (_guard: () => boolean): (() => void) =>
    () => {},
  allow: (): boolean => true,
});

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guard = useRef<(() => boolean) | null>(null);
  const [value] = useState(() => ({
    register(next: () => boolean) {
      guard.current = next;
      return () => {
        if (guard.current === next) guard.current = null;
      };
    },
    allow: () => guard.current?.() ?? true,
  }));
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useNavigationGuard = () => useContext(Context);
