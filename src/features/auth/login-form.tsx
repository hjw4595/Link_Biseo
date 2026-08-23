'use client';
import { useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { safeNext } from './redirect';

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError: string | null;
}) {
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invalid, setInvalid] = useState<'email' | 'password' | null>(null);
  const [message, setMessage] = useState(initialError);
  const busy = useRef(false);
  async function loginWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setInvalid('email');
      setMessage('올바른 이메일을 입력해주세요.');
      event.currentTarget.querySelector<HTMLInputElement>('#email')?.focus();
      return;
    }
    if (!password.trim()) {
      setInvalid('password');
      setMessage('비밀번호를 입력해주세요.');
      event.currentTarget.querySelector<HTMLInputElement>('#password')?.focus();
      return;
    }
    busy.current = true;
    setPending('email');
    setInvalid(null);
    setMessage(null);
    try {
      const { data, error } = await createClient().auth.signInWithPassword({
        email: normalizedEmail,
        // Whitespace can be part of a password. Never normalize it.
        password,
      });
      if (error) {
        setMessage(
          error.status &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429
            ? '이메일 또는 비밀번호를 확인해주세요.'
            : '로그인에 실패했어요. 잠시 후 다시 시도해주세요.',
        );
      } else if (data.session && data.user) {
        setPassword('');
        // The SDK has saved SSR cookies. Re-enter the existing server guard and
        // AuthProvider verification before mounting any user-scoped queries.
        window.location.replace(safeNext(next));
        return;
      } else {
        setMessage('로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    } catch {
      setMessage('로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
    busy.current = false;
    setPending(null);
  }
  async function login() {
    if (busy.current) return;
    busy.current = true;
    setPending('google');
    setInvalid(null);
    setMessage(null);
    try {
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', safeNext(next));
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback.href, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw new Error();
      window.location.assign(data.url);
    } catch {
      setMessage(
        '로그인을 시작하지 못했어요. 인증 설정과 네트워크를 확인한 뒤 다시 시도해 주세요.',
      );
      busy.current = false;
      setPending(null);
    }
  }
  return (
    <div className="space-y-4">
      <form
        method="post"
        noValidate
        onSubmit={(event) => void loginWithEmail(event)}
        className="space-y-4"
        aria-busy={pending === 'email'}
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            이메일
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            disabled={pending !== null}
            aria-invalid={invalid === 'email'}
            aria-describedby={message ? 'login-message' : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            비밀번호
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            disabled={pending !== null}
            aria-invalid={invalid === 'password'}
            aria-describedby={message ? 'login-message' : undefined}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {message && (
          <p
            id="login-message"
            role="alert"
            className="break-words text-sm leading-6 text-destructive"
          >
            {message}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          loading={pending === 'email'}
          disabled={pending !== null}
        >
          {pending === 'email' ? '로그인 중…' : '이메일로 로그인'}
        </Button>
      </form>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        또는
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        variant="secondary"
        className="w-full gap-3 text-foreground"
        loading={pending === 'google'}
        disabled={pending !== null}
        onClick={() => void login()}
      >
        {pending !== 'google' && (
          <Image
            src="/google-logo.png"
            width={200}
            height={204}
            className="h-auto w-5"
            alt=""
          />
        )}
        Google로 계속하기
      </Button>
    </div>
  );
}
