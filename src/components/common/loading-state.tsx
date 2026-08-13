import { LoaderCircle } from 'lucide-react';

export function LoadingState({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-col items-center gap-4 text-center"
    >
      <span
        className="flex size-12 items-center justify-center rounded-full bg-surface text-accent"
        aria-hidden="true"
      >
        <LoaderCircle className="size-5 motion-safe:animate-spin" />
      </span>
      <p className="max-w-full text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
        {text}
      </p>
    </div>
  );
}
