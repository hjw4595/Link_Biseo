import type { ReactNode } from 'react';
import { AppShell } from '@/components/common/app-shell';
export default function DiagnosticsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell navigation={false}>{children}</AppShell>;
}
