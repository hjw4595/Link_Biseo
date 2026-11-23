import { ApiRequestError } from '@/lib/api/client';

export function categoryErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.kind === 'http') {
    if (error.status === 409)
      return '같은 이름의 카테고리가 있어요. 다른 이름을 입력해 주세요.';
    if (error.status === 404)
      return '카테고리를 찾을 수 없어요. 목록을 새로 불러와 주세요.';
    if (error.status === 400) return '입력한 내용을 확인해 주세요.';
  }
  if (error instanceof ApiRequestError)
    return {
      unauthorized: '로그인 상태를 확인할 수 없어요. 다시 로그인해 주세요.',
      forbidden: '카테고리에 접근할 권한이 없어요.',
      network: '연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.',
      server: '잠시 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
      http: '카테고리 응답을 확인할 수 없어요.',
      invalid: '카테고리 응답을 확인할 수 없어요.',
      timeout: '응답 시간이 초과됐어요. 다시 시도해 주세요.',
      aborted: '요청이 취소됐어요.',
      configuration: '서비스 연결 설정을 확인해 주세요.',
    }[error.kind];
  return '처리하지 못했어요. 다시 시도해 주세요.';
}
