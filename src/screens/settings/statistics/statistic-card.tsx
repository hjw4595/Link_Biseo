import type { ReactNode } from 'react';
export function StatisticCard({
  title,
  value,
  description,
  accessibleTitle = title,
}: {
  title: string;
  value: ReactNode;
  description?: string;
  accessibleTitle?: string;
}) {
  return (
    <div
      className="min-h-[120px] min-w-0 rounded-xl border bg-surface p-4"
      aria-label={accessibleTitle}
    >
      <h3 className="text-sm break-keep text-muted-foreground">{title}</h3>
      <div className="mt-3 break-words text-2xl font-semibold tabular-nums">
        {value}
      </div>
      {description && (
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
