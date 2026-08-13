import type { ReactNode } from 'react';
import { AppShell } from '@/components/common/app-shell';
import { DemoProvider } from '@/lib/mock/demo-provider';
export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <AppShell>{children}</AppShell>
    </DemoProvider>
  );
}
