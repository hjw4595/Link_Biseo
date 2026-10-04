'use client';
import { useRef } from 'react';
import { TopBar } from '@/components/common/top-bar';
import { CleanupNotice } from '@/features/links/components/cleanup-notice';

// Development-only regression harness. Uses the normal authenticated provider
// and existing cleanup API fixture; never mounted by the production Home/report.
export function CleanupPreview() {
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <>
      <TopBar title="Cleanup UI 검증 · 개발 전용" backHref="/" />
      <div className="screen-content">
        <h1 ref={heading} tabIndex={-1}>
          미사용 링크 정리 검증
        </h1>
        <CleanupNotice fallbackFocus={heading} />
      </div>
    </>
  );
}
