import {
  isPingResponse,
  isStatusResponse,
  isOpenResponse,
  type ExtensionRequest,
  type CommonErrorCode,
} from '../../contracts/browser-extension';
import { safeExternalUrl } from '../url';

export type FailureKind =
  | 'unsupported'
  | 'configuration'
  | 'transport'
  | 'timeout'
  | 'invalid'
  | 'rejected'
  | 'partial'
  | 'unknown'
  | 'aborted'
  | 'busy';
export class ExtensionError extends Error {
  constructor(
    public readonly kind: FailureKind,
    message: string,
  ) {
    super(message);
  }
}
export interface ExtensionRuntime {
  sendMessage: (
    id: string,
    message: ExtensionRequest,
    callback: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
}
// The only Chrome surface consumed by the web app. Replies remain unknown.
declare global {
  interface Window {
    chrome?: { runtime?: ExtensionRuntime };
  }
}
function runtime() {
  if (
    typeof window === 'undefined' ||
    !/Chrome\//.test(navigator.userAgent) ||
    /Edg\/|OPR\//.test(navigator.userAgent)
  )
    throw new ExtensionError(
      'unsupported',
      '시크릿 실행은 PC Chrome에서 사용할 수 있어요.',
    );
  const api = window.chrome?.runtime;
  if (!api || typeof api.sendMessage !== 'function')
    throw new ExtensionError(
      'transport',
      'Chrome 확장 프로그램을 연결할 수 없습니다.',
    );
  return api;
}
export function sendExtensionMessage(
  api: ExtensionRuntime,
  id: string | undefined,
  request: ExtensionRequest,
  signal?: AbortSignal,
  timeoutMs = 3000,
): Promise<unknown> {
  if (!id || !/^[a-p]{32}$/.test(id))
    return Promise.reject(
      new ExtensionError(
        'configuration',
        '확장 프로그램 ID 설정을 확인해 주세요.',
      ),
    );
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: ExtensionError | null, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(value);
    };
    const abort = () =>
      finish(
        new ExtensionError('aborted', '시크릿 실행 결과 확인이 취소됐어요.'),
      );
    const timer = setTimeout(
      () =>
        finish(
          new ExtensionError(
            'timeout',
            '응답 시간이 초과됐어요. 창이 열렸을 수 있으니 확인해 주세요. 자동으로 다시 실행하지 않아요.',
          ),
        ),
      timeoutMs,
    );
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    try {
      api.sendMessage(id, request, (response) => {
        // Read lastError even after timeout to consume Chrome's callback error.
        const error = api.lastError;
        if (error || response === undefined)
          finish(
            new ExtensionError(
              'transport',
              'Chrome 확장 프로그램을 연결할 수 없습니다. 실행 요청 후라면 실제 창을 확인해 주세요.',
            ),
          );
        else finish(null, response);
      });
    } catch {
      finish(
        new ExtensionError(
          'transport',
          'Chrome 확장 프로그램을 연결할 수 없습니다.',
        ),
      );
    }
  });
}
const send = (request: ExtensionRequest, signal?: AbortSignal) =>
  sendExtensionMessage(
    runtime(),
    process.env.NEXT_PUBLIC_BISEO_EXTENSION_ID,
    request,
    signal,
  );
const invalid = () =>
  new ExtensionError(
    'invalid',
    '확장 프로그램 응답을 확인할 수 없어요. 실행 요청 후라면 창을 확인해 주세요. 자동으로 다시 실행하지 않아요.',
  );
function commonFailure(code: CommonErrorCode) {
  return new ExtensionError(
    'rejected',
    code === 'UNSUPPORTED_TYPE' || code === 'UNSUPPORTED_VERSION'
      ? '링크비서 확장 프로그램을 업데이트해 주세요.'
      : '확장 프로그램 연결 또는 권한을 확인하지 못했어요. 허용된 웹앱 주소와 확장 설정을 확인해 주세요.',
  );
}
export async function checkExtension(signal?: AbortSignal) {
  const ping = await send({ type: 'BISEO_PING', version: 1 }, signal);
  if (!isPingResponse(ping)) throw invalid();
  if (!ping.ok) throw commonFailure(ping.error.code);
  const status = await send({ type: 'BISEO_GET_STATUS', version: 1 }, signal);
  if (!isStatusResponse(status)) throw invalid();
  if (!status.ok) throw commonFailure(status.error.code);
  return status.incognitoAllowed;
}
export async function openIncognitoUrls(
  urls: readonly string[],
  signal?: AbortSignal,
) {
  if (
    urls.length < 1 ||
    urls.length > 8 ||
    !Array.from(urls).every(
      (url) => typeof url === 'string' && safeExternalUrl(url),
    )
  )
    throw new ExtensionError(
      'rejected',
      '시크릿 실행은 안전한 HTTP/HTTPS 링크 1~8개만 실행할 수 있어요. 일부만 실행하지 않아요.',
    );
  const response = await send(
    { type: 'BISEO_OPEN_URLS', version: 1, mode: 'incognito', urls: [...urls] },
    signal,
  );
  if (!isOpenResponse(response, urls.length)) throw invalid();
  if (response.ok) return;
  if (response.code === 'PARTIAL_OPEN_FAILED')
    throw new ExtensionError(
      'partial',
      `${response.openedCount}개 탭 생성만 확인됐어요. 어떤 링크인지는 확인할 수 없어 사용 기록을 저장하지 않았어요. 실제 창을 확인해 주세요. 자동으로 다시 실행하지 않아요.`,
    );
  if (response.code === 'OPEN_FAILED')
    throw new ExtensionError(
      'unknown',
      '시크릿 창 생성 결과를 확인할 수 없어요. 창이 이미 열렸을 수 있어요. 사용 기록을 저장하거나 자동으로 다시 실행하지 않아요.',
    );
  throw new ExtensionError(
    'rejected',
    response.code === 'INCOGNITO_NOT_ALLOWED'
      ? '시크릿 모드 허용이 필요합니다. Chrome 확장 프로그램 세부정보에서 시크릿 모드에서 허용을 켜 주세요. 일반 창으로 다시 실행하지 않아요.'
      : '확장 프로그램이 실행 요청을 거부했어요. 창을 생성하지 않았어요. 연결 설정과 URL을 확인해 주세요.',
  );
}
