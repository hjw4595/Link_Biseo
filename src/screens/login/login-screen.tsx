import { AppShell } from '@/components/common/app-shell';
import { TopBar } from '@/components/common/top-bar';
import { LoginForm } from '@/screens/login/components/login-form';

export function LoginScreen({
  next,
  initialError,
}: {
  next: string;
  initialError: string | null;
}) {
  return (
    <AppShell navigation={false}>
      <TopBar title="링크비서" brand />
      <div className="screen-content min-h-[calc(100dvh-64px)] justify-center gap-12 pb-16">
        <div className="space-y-4">
          <h1 className="text-hero font-semibold tracking-tight">
            필요한 링크를 한곳에.
          </h1>
          <p className="leading-7 text-muted-foreground">
            링크를 저장하고, 관심사별로 정리해보세요.
          </p>
        </div>
        <LoginForm next={next} initialError={initialError} />
      </div>
    </AppShell>
  );
}
