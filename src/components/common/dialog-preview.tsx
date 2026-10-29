'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from './confirm-dialog';
import { NoticeDialog } from './notice-dialog';

/** Development-only gallery, mounted solely by /dev/ui. */
export function DialogPreview() {
  const [mode, setMode] = useState<'default' | 'destructive' | 'notice' | null>(
    null,
  );
  const [result, setResult] = useState('success');
  const [calls, setCalls] = useState(0);
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">공용 팝업</h2>
      <label className="block">
        확인 결과 예시{' '}
        <select
          value={result}
          onChange={(event) => setResult(event.target.value)}
        >
          <option value="success">성공</option>
          <option value="false">실패 반환</option>
          <option value="reject">실패 예외</option>
        </select>
      </label>
      <p data-testid="confirm-calls">확인 호출 {calls}회</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setMode('default')}>일반 확인 예시</Button>
        <Button variant="destructive" onClick={() => setMode('destructive')}>
          삭제 확인 예시
        </Button>
        <Button onClick={() => setMode('notice')}>필수 안내 예시</Button>
      </div>
      <ConfirmDialog
        open={mode === 'default' || mode === 'destructive'}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
        title={
          mode === 'destructive'
            ? '이 항목을 삭제할까요?'
            : '변경사항을 적용할까요?'
        }
        description="작업 내용을 확인해 주세요. 긴 제목과 설명도 화면 안에서 읽을 수 있으며, 처리 중에는 중복 요청과 닫힘을 방지합니다."
        variant={mode === 'destructive' ? 'destructive' : 'default'}
        confirmLabel="진행"
        cancelLabel="돌아가기"
        onConfirm={async () => {
          setCalls((count) => count + 1);
          await new Promise((resolve) => setTimeout(resolve, 700));
          if (result === 'reject') throw new Error('preview');
          return result === 'success';
        }}
      />
      <NoticeDialog
        open={mode === 'notice'}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
        title="필수 안내"
        description="사용자가 반드시 읽어야 하는 안내에만 사용합니다. 일반적인 성공 메시지를 이 팝업으로 바꾸지 않습니다."
        confirmLabel="읽었어요"
      />
    </section>
  );
}
