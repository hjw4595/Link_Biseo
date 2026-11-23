import { ApiRequestError, httpError } from './client';

function checkResponse(response: Response, expectedStatus?: number) {
  if (!response.ok) throw httpError(response.status);
  if (expectedStatus !== undefined && response.status !== expectedStatus)
    throw new ApiRequestError('invalid');
}

async function readResponseBody(
  response: Response,
  expectedStatus?: number,
): Promise<unknown> {
  checkResponse(response, expectedStatus);
  if (response.status === 204) return undefined;
  try {
    const value: unknown = await response.json();
    return value;
  } catch {
    throw new ApiRequestError('invalid');
  }
}

export async function readJsonResponse<T>(
  response: Response,
  validate: (value: unknown) => value is T,
  expectedStatus?: number,
): Promise<T> {
  const value = await readResponseBody(response, expectedStatus);
  if (!validate(value)) throw new ApiRequestError('invalid');
  return value;
}

export function expectEmptyResponse(response: Response): void {
  checkResponse(response, 204);
}
