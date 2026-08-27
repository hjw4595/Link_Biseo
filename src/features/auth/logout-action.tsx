'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from './auth-provider';
export function LogoutAction() {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  async function logout() {
    setPending(true);
    setLogoutError(null);
    const error = await signOut();
    if (error) {
      setLogoutError(error);
      setPending(false);
    }
  }
  return (
    <div className="space-y-3">
      {' '}
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => void logout()}
      >
        로그아웃
      </Button>
      {logoutError && (
        <p role="alert" className="text-sm leading-6 text-destructive">
          {logoutError}
        </p>
      )}
    </div>
  );
}
