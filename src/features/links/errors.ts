import { ApiRequestError } from '@/lib/api/client';

export function linkErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.kind === 'http') {
    if (error.status === 400) return '입력값이나 목록 조건을 확인해 주세요.';
    if (error.status === 404) return '링크 또는 카테고리를 찾을 수 없어요.';
    if (error.status === 409)
      return '이미 저장한 링크예요. 입력한 내용은 유지돼요.';
  }
  if (error instanceof ApiRequestError) {
    if (error.kind === 'unauthorized')
      return '로그인 상태를 확인할 수 없어요. 다시 로그인해 주세요.';
    if (error.kind === 'forbidden') return '접근 권한이 없어요.';
    if (error.kind === 'invalid') return '서버 응답을 확인할 수 없어요.';
    if (error.kind === 'timeout')
      return '응답 시간이 초과됐어요. 목록을 확인한 후 다시 시도해 주세요.';
    if (error.kind === 'network')
      return '연결하지 못했어요. 네트워크를 확인해 주세요.';
  }
  return '처리하지 못했어요. 다시 시도해 주세요.';
}
