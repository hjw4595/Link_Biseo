import type { ReactNode } from 'react';

export function SkeletonStatus({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="min-w-0"
    >
      <span className="sr-only">{text}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
