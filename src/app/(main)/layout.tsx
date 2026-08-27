import { LinkRegistrationProvider } from '@/features/links/components/link-registration';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { verifiedUser } from '@/features/auth/server';
import { AuthProvider } from '@/features/auth/auth-provider';

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await verifiedUser();
  if (!user) redirect('/login?error=session');
  return (
    <AuthProvider initialUser={user}>
      <LinkRegistrationProvider>{children}</LinkRegistrationProvider>
    </AuthProvider>
  );
}
