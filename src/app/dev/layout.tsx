import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/common/app-shell';
import { devPreviewsEnabled } from '@/screens/dev/access';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DevLayout({ children }: { children: ReactNode }) {
  if (!devPreviewsEnabled()) notFound();
  const { DemoProvider } = await import('@/lib/mock/demo-provider');
  return (
    <DemoProvider>
      <AppShell>{children}</AppShell>
    </DemoProvider>
  );
}
