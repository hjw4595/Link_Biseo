import { MissingResource } from '@/components/common/missing-resource';
import { AppShell } from '@/components/common/app-shell';
export default function NotFound() {
  return (
    <AppShell navigation={false}>
      <MissingResource />
    </AppShell>
  );
}
