import { ApiRequestError } from '../../lib/api/client';
import { LinkApiError } from '../../lib/api/links';
import type { CreateLinkRequest, LinkResponse } from '../../contracts/links';

export type Outcome =
  | 'not_attempted'
  | 'importing'
  | 'imported'
  | 'duplicate_server'
  | 'failed'
  | 'unknown';
export interface RunItem {
  readonly localId: string;
  readonly title: string;
  readonly key: string;
  readonly input: Readonly<CreateLinkRequest>;
}
export interface ItemResult {
  item: RunItem;
  outcome: Outcome;
  savedLinkId?: string;
  reason?: string;
  reconciliation?: 'found' | 'not_found';
}
export interface RunControl {
  stopped: boolean;
  reason?: string;
}

export function classifyImportError(error: unknown): {
  outcome: Outcome;
  reason: string;
  stop: boolean;
  category?: boolean;
} {
  if (error instanceof LinkApiError) {
    if (error.status === 409)
      return {
        outcome: 'duplicate_server',
        reason: '이미 저장된 링크',
        stop: false,
      };
    if (error.status === 400)
      return { outcome: 'failed', reason: '입력값 확인 필요', stop: false };
    if (error.status === 404)
      return {
        outcome: 'failed',
        reason: '카테고리 재확인 필요',
        stop: true,
        category: true,
      };
    if (error.status === 429)
      return {
        outcome: 'unknown',
        reason: '요청 제한 — 저장 여부 재확인 필요',
        stop: true,
      };
  }
  if (
    error instanceof ApiRequestError &&
    ['unauthorized', 'forbidden', 'configuration', 'aborted'].includes(
      error.kind,
    )
  ) {
    // No status can mean identity changed AFTER a committed response. Stay conservative.
    return {
      outcome:
        error.status === 401 ||
        error.status === 403 ||
        error.kind === 'configuration'
          ? 'failed'
          : 'unknown',
      reason: '인증 또는 계정 상태 확인 필요',
      stop: true,
    };
  }
  return {
    outcome: 'unknown',
    reason: '서버 저장 여부 확인 불가',
    stop: true,
  };
}

// Exactly two worker loops. React/effects do not own dispatch or retry.
export async function runImport(
  items: readonly RunItem[],
  control: RunControl,
  live: () => boolean,
  save: (item: RunItem) => Promise<LinkResponse>,
  publish: (result: ItemResult) => void,
  categoryMissing: () => void,
) {
  let next = 0;
  async function worker() {
    while (!control.stopped && live()) {
      const item = items[next++];
      if (!item) return;
      publish({ item, outcome: 'importing' });
      let result: ItemResult;
      try {
        const saved = await save(item);
        result = { item, outcome: 'imported', savedLinkId: saved.id };
      } catch (error) {
        const failure = classifyImportError(error);
        result = { item, outcome: failure.outcome, reason: failure.reason };
        if (failure.stop) {
          control.stopped = true;
          control.reason = failure.reason;
        }
        if (failure.category && live()) categoryMissing();
      }
      if (!live()) return;
      publish(result);
    }
  }
  await Promise.all([worker(), worker()]);
}
