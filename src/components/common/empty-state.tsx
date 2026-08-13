import { Bookmark } from 'lucide-react';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};
export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-start gap-3 rounded-lg border p-4'
          : 'flex flex-col items-center gap-4 py-12 text-center'
      }
    >
      {!compact && (
        <Bookmark className="size-7 text-muted-foreground" aria-hidden="true" />
      )}
      <div className="space-y-2">
        <p className="text-list font-medium">{title}</p>
        <p className="max-w-64 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
