import { AppShell } from '@/components/common/app-shell';
import { LoadingState } from '@/components/common/loading-state';
export function AuthLoading() {
  return (
    <AppShell navigation={false}>
      <div className="screen-content min-h-dvh justify-center">
        <LoadingState text="로그인 상태를 확인하고 있어요." />
      </div>
    </AppShell>
  );
}
