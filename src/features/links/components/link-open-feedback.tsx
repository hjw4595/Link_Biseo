'use client';
import { Button, buttonVariants } from '@/components/ui/button';
import type { useLinkOpen } from '../use-link-open';
import { safeExternalUrl } from '@/lib/url';
import { useIncognito } from '@/features/link-launch/provider';

export function LinkOpenFeedback({
  opening,
}: {
  opening: ReturnType<typeof useLinkOpen>;
}) {
  const { state, cancel } = opening;
  const { incognito } = useIncognito();
  if (!state || (!state.pending && !state.error)) return null;
  const safe = safeExternalUrl(state.link.url);
  return (
    <div
      className="space-y-2 rounded-sm border p-3"
      aria-label="링크 열기 상태"
    >
      {state.pending ? (
        <>
          <p role="status">
            {state.incognito
              ? '시크릿 실행 및 사용 기록을 처리하고 있어요.'
              : `${state.link.title} 사용 기록을 저장하고 있어요.`}
          </p>
          {!state.incognito && (
            <Button size="sm" variant="ghost" onClick={cancel}>
              열기 취소
            </Button>
          )}
        </>
      ) : (
        <>
          <p role="alert">{state.error}</p>
          {state.canContinue && !state.incognito && !incognito && safe && (
            <a
              href={safe.href}
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              기록 없이 열기
            </a>
          )}
          <Button size="sm" variant="ghost" onClick={cancel}>
            안내 닫기
          </Button>
        </>
      )}
    </div>
  );
}
