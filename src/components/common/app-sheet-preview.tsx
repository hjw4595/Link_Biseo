'use client';
import { useState } from 'react';
import {
  AppSheet,
  AppSheetHeader,
  AppSheetContent,
  AppSheetFooter,
} from './app-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Development-only composition example, mounted by the existing /dev/ui gate. */
export function AppSheetPreview() {
  const [open, setOpen] = useState(false);
  const [footer, setFooter] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">AppSheet</h2>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={footer}
          onChange={(event) => setFooter(event.target.checked)}
        />
        Sheet Footer 표시
      </label>
      <Button onClick={() => setOpen(true)}>공통 Sheet 예시</Button>
      <AppSheet open={open} onOpenChange={setOpen} busy={busy}>
        <AppSheetHeader
          title="공통 Sheet 예시"
          description="편집 패널의 공통 레이아웃을 확인합니다."
        />
        <AppSheetContent>
          <label className="block space-y-2">
            예시 이름
            <Input autoFocus />
          </label>
          <Button
            className="my-3"
            variant="secondary"
            onClick={() => setBusy(!busy)}
          >
            {busy ? '처리 완료 예시' : '처리 중 예시'}
          </Button>
          {Array.from({ length: 40 }, (_, i) => (
            <p className="py-3" key={i}>
              스크롤 콘텐츠 {i + 1}
            </p>
          ))}
        </AppSheetContent>
        {footer && (
          <AppSheetFooter>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button disabled={busy} onClick={() => setOpen(false)}>
              완료
            </Button>
          </AppSheetFooter>
        )}
      </AppSheet>
    </section>
  );
}
