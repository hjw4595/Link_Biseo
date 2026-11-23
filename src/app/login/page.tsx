import { LoginScreen } from '@/screens/login/login-screen';
import { redirect } from 'next/navigation';
import { verifiedUser } from '@/features/auth/server';
import { safeNext } from '@/features/auth/redirect';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ user, error }, params] = await Promise.all([
    verifiedUser(),
    searchParams,
  ]);
  if (user) redirect('/');
  const message =
    error === 'configuration'
      ? 'Supabase 공개 URL과 공개 키가 없거나 올바르지 않아요. 실행 환경 설정을 확인해 주세요.'
      : params.error === 'logout'
        ? '이 기기의 세션은 종료됐지만 서버의 세션 종료는 확인하지 못했어요. 네트워크 또는 인증 서비스 오류가 발생했어요.'
        : params.error === 'oauth'
          ? '로그인을 완료하지 못했어요. 인증을 취소했거나 요청이 만료됐을 수 있어요. 다시 시도해 주세요.'
          : params.error
            ? '로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.'
            : null;
  return <LoginScreen next={safeNext(params.next)} initialError={message} />;
}
