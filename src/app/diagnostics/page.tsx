import { TopBar } from '@/components/common/top-bar';
import { ApiStatus } from '@/components/common/api-status';

export default function DiagnosticsPage() {
  return (
    <>
      <TopBar title="API 연결 진단" backHref="/settings" />
      <div className="screen-content">
        <div className="space-y-3">
          <h1 className="text-hero font-semibold">Foundation 상태</h1>
          <p className="leading-relaxed text-muted-foreground">
            기존 Health API의 연결 상태를 확인해요. 데모 화면은 이 연결 없이도
            이용할 수 있어요.
          </p>
        </div>
        <ApiStatus />
      </div>
    </>
  );
}
