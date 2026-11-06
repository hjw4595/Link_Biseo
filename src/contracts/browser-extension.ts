// Mirrored from biseo_ex/FE_CONTRACT.md (extension 0.3.0, protocol 1).
// Not a database/API entity. Validate all external replies from unknown.
export type ExtensionRequest =
  | { type: 'BISEO_PING' | 'BISEO_GET_STATUS'; version: 1 }
  | { type: 'BISEO_OPEN_URLS'; version: 1; mode: 'incognito'; urls: string[] };
const commonCodes = [
  'FORBIDDEN_ORIGIN',
  'INVALID_MESSAGE',
  'UNSUPPORTED_TYPE',
  'UNSUPPORTED_VERSION',
  'INTERNAL_ERROR',
] as const;
const openCodes = [
  'INVALID_REQUEST',
  'UNAUTHORIZED_ORIGIN',
  'SOURCE_WINDOW_NOT_FOUND',
  'INCOGNITO_NOT_ALLOWED',
  'OPEN_FAILED',
  'PARTIAL_OPEN_FAILED',
] as const;
export type CommonErrorCode = (typeof commonCodes)[number];
export type OpenErrorCode = (typeof openCodes)[number];
export type CommonError = {
  ok: false;
  type: 'BISEO_ERROR';
  version: 1;
  error: { code: CommonErrorCode };
};
export type PingResponse =
  { ok: true; type: 'BISEO_PONG'; version: 1 } | CommonError;
export type StatusResponse =
  | {
      ok: true;
      type: 'BISEO_STATUS_RESULT';
      version: 1;
      incognitoAllowed: boolean;
    }
  | CommonError;
export type OpenResponse =
  | {
      ok: true;
      type: 'BISEO_OPEN_URLS_RESULT';
      version: 1;
      requestedCount: number;
      openedCount: number;
    }
  | {
      ok: false;
      type: 'BISEO_OPEN_URLS_ERROR';
      version: 1;
      code: OpenErrorCode;
      requestedCount?: number;
      openedCount?: number;
    };
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function commonError(
  v: Record<string, unknown>,
): v is Record<string, unknown> & CommonError {
  const error = v.error;
  return (
    v.ok === false &&
    v.type === 'BISEO_ERROR' &&
    record(error) &&
    commonCodes.some((code) => code === error.code)
  );
}
export function isPingResponse(v: unknown): v is PingResponse {
  return (
    record(v) &&
    v.version === 1 &&
    (commonError(v) || (v.ok === true && v.type === 'BISEO_PONG'))
  );
}
export function isStatusResponse(v: unknown): v is StatusResponse {
  return (
    record(v) &&
    v.version === 1 &&
    (commonError(v) ||
      (v.ok === true &&
        v.type === 'BISEO_STATUS_RESULT' &&
        typeof v.incognitoAllowed === 'boolean'))
  );
}
export function isOpenResponse(
  v: unknown,
  requested: number,
): v is OpenResponse {
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > 8)
    return false;
  if (!record(v) || v.version !== 1) return false;
  if (v.ok === true)
    return (
      v.type === 'BISEO_OPEN_URLS_RESULT' &&
      count(v.requestedCount) &&
      v.requestedCount === requested &&
      v.openedCount === requested
    );
  if (
    v.ok !== false ||
    v.type !== 'BISEO_OPEN_URLS_ERROR' ||
    !openCodes.some((code) => code === v.code)
  )
    return false;
  if (v.code === 'PARTIAL_OPEN_FAILED')
    return (
      v.requestedCount === requested &&
      count(v.openedCount) &&
      v.openedCount > 0 &&
      v.openedCount < requested
    );
  if (v.code === 'OPEN_FAILED')
    return (
      (v.requestedCount === undefined && v.openedCount === undefined) ||
      (v.requestedCount === requested && v.openedCount === 0)
    );
  return v.requestedCount === undefined && v.openedCount === undefined;
}
