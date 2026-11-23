'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getHealth } from '@/lib/api/health';

type ConnectionState = 'checking' | 'connected' | 'unavailable';
export function ApiStatus() {
  const [state, setState] = useState<ConnectionState>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setState('connected');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('unavailable');
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <section
      aria-label="API connection"
      className="space-y-4 rounded-lg border p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium">API</h2>
        <p role="status" className="text-sm text-muted-foreground">
          {state === 'checking'
            ? 'Checking…'
            : state === 'connected'
              ? 'Connected'
              : 'Unavailable'}
        </p>
      </div>
      {state === 'unavailable' && (
        <Button
          variant="outline"
          onClick={() => {
            setState('checking');
            setAttempt((value) => value + 1);
          }}
        >
          다시 확인
        </Button>
      )}
    </section>
  );
}
