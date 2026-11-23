import { TopBar } from '@/components/common/top-bar';
import { ApiStatus } from '@/screens/diagnostics/components/api-status';

export function DiagnosticsScreen() {
  return (
    <>
      <TopBar title="API 연결 진단" backHref="/settings" />
      <div className="screen-content">
        <div className="space-y-3">
          <h1 className="text-hero font-semibold">API 서버 상태</h1>
          <p className="leading-relaxed text-muted-foreground">
            API 서버의 연결 상태를 확인해요. 이 결과는 로그인이나 링크 데이터의
            정상 동작 여부를 보장하지 않아요.
          </p>
        </div>
        <ApiStatus />
      </div>
    </>
  );
}
