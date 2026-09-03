'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ScopeContext = createContext<(() => AbortSignal) | null>(null);
// Mounted only below verified AuthProvider and keyed by user ID. No shared SSR cache.
export function UserQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 15000,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  const controller = useRef(new AbortController());
  useEffect(() => {
    controller.current = new AbortController();
    return () => {
      controller.current.abort();
      void client.cancelQueries();
      client.clear();
    };
  }, [client]);
  return (
    <QueryClientProvider client={client}>
      <ScopeContext.Provider value={() => controller.current.signal}>
        {children}
      </ScopeContext.Provider>
    </QueryClientProvider>
  );
}
export function useRequestScope() {
  const scope = useContext(ScopeContext);
  if (!scope) throw new Error('UserQueryProvider is required');
  return scope;
}
