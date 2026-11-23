import { ApiRequestError } from '@/lib/api/client';

export function presetErrorMessage(error: unknown, list = false) {
  if (error instanceof ApiRequestError && error.kind === 'http') {
    if (error.status === 404 && list)
      return '빠른 실행 API가 아직 제공되지 않아요.';
    if (error.status === 404 || error.status === 409)
      return '빠른 실행 또는 링크가 변경됐어요. 목록을 다시 확인해 주세요.';
    if (error.status === 400)
      return '이름과 선택한 링크를 확인해 주세요. 빠른 실행은 최대 50개, 새로 포함할 링크는 최대 8개예요.';
    if (error.status === 429)
      return '요청이 많아요. 잠시 후 목록을 다시 확인해 주세요.';
  }
  if (error instanceof ApiRequestError) {
    if (error.kind === 'unauthorized')
      return '로그인 상태를 다시 확인해 주세요.';
    if (error.kind === 'forbidden') return '이 빠른 실행에 접근할 수 없어요.';
    if (error.kind === 'invalid')
      return '빠른 실행 API 응답을 확인할 수 없어요.';
    if (error.status === 501) return '빠른 실행 API가 아직 제공되지 않아요.';
  }
  return '빠른 실행 서버에 연결하지 못했어요. 저장 요청 후라면 목록을 다시 확인해 주세요.';
}
