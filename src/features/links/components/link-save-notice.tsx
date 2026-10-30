'use client';
import { useEffect, useState } from 'react';

// AppShell survives the successful replace navigation; the notice is memory-only.
export function LinkSaveNotice() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 4000);
    };
    window.addEventListener('link-registered', show);
    return () => {
      window.removeEventListener('link-registered', show);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        visible
          ? 'pointer-events-none fixed bottom-[calc(100px+env(safe-area-inset-bottom))] left-1/2 z-50 max-w-[calc(100%_-_40px)] -translate-x-1/2 rounded-md border bg-surface-raised px-4 py-3 text-sm shadow-lg lg:bottom-6'
          : 'sr-only'
      }
    >
      {visible ? '링크가 등록됐어요.' : ''}
    </div>
  );
}
