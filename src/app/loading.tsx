import { AppShell } from '@/components/common/app-shell';
import { LoadingState } from '@/components/common/loading-state';

export default function Loading() {
  return (
    <AppShell navigation={false}>
      <div className="screen-content min-h-dvh justify-center">
        <LoadingState text="링크비서를 준비하고 있어요." />
      </div>
    </AppShell>
  );
}
