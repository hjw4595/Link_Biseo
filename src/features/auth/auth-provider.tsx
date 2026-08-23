'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { UserQueryProvider } from '@/lib/query/provider';
import { AppShell } from '@/components/common/app-shell';
import { Button } from '@/components/ui/button';
import { AuthLoading } from './auth-loading';

type AuthState =
  | { status: 'initializing' | 'unauthenticated' }
  | { status: 'authenticated'; user: User }
  | { status: 'error'; message: string };
const AuthContext = createContext<{
  user: User;
  signOut: () => Promise<string | null>;
} | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>({
    status: 'initializing',
  });
  const signingOut = useRef(false);
  useEffect(() => {
    let live = true;
    let generation = 0;
    const client = createClient();
    async function verify() {
      const current = ++generation;
      try {
        const { data, error } = await client.auth.getUser();
        if (!live || current !== generation || signingOut.current) return;
        if (
          error &&
          error.name !== 'AuthSessionMissingError' &&
          (!error.status || error.status >= 500)
        ) {
          setState({
            status: 'error',
            message: '로그인 상태를 확인할 수 없어요. 다시 시도해 주세요.',
          });
        } else if (!data.user || error) {
          setState({ status: 'unauthenticated' });
          window.location.replace('/login?error=session');
        } else setState({ status: 'authenticated', user: data.user });
      } catch {
        if (live)
          setState({
            status: 'error',
            message: '로그인 상태를 확인할 수 없어요.',
          });
      }
    }
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (signingOut.current) return;
      if (event === 'SIGNED_OUT') {
        generation++;
        setState({ status: 'unauthenticated' });
        window.location.replace('/login');
      } else {
        if (session?.user.id !== initialUser.id)
          setState({ status: 'initializing' });
        // Leave the SDK auth lock before making another auth request.
        setTimeout(() => {
          if (live) void verify();
        }, 0);
      }
    });
    const onFocus = () => {
      void verify();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      live = false;
      generation++;
      data.subscription.unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [initialUser.id]);

  async function signOut() {
    if (signingOut.current) return null;
    signingOut.current = true;
    try {
      const client = createClient();
      const { error } = await client.auth.signOut({ scope: 'local' });
      const result = await client.auth.getSession();
      if (result.error || result.data.session) {
        signingOut.current = false;
        return '세션 종료를 확인하지 못했어요. 다시 시도해 주세요.';
      }
      setState({ status: 'unauthenticated' });
      // Current SDK clears local cookies even if remote revocation fails.
      window.location.replace(error ? '/login?error=logout' : '/login');
      return null;
    } catch {
      signingOut.current = false;
      return '로그아웃하지 못했어요. 다시 시도해 주세요.';
    }
  }
  if (state.status === 'error')
    return (
      <AppShell navigation={false}>
        <div className="screen-content">
          <p role="alert">{state.message}</p>
          <Button onClick={() => window.location.reload()}>다시 확인</Button>
        </div>
      </AppShell>
    );
  if (state.status !== 'authenticated') return <AuthLoading />;
  return (
    <AuthContext.Provider value={{ user: state.user, signOut }}>
      <UserQueryProvider key={state.user.id}>
        <AppShell>{children}</AppShell>
      </UserQueryProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
