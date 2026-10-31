'use client';
import { useState } from 'react';
import { PieChart, Pie, Sector, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DistributionItem } from '../adapters/category-distribution';

export function CategoryDistribution({
  items,
  total,
}: {
  items: DistributionItem[];
  total: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId);
  // Clear deleted/zero/grouped-away IDs before commit; displayed UUIDs retain selection across ranking changes.
  if (selectedId && !selected) setSelectedId(null);
  if (hoverId && !items.some((item) => item.id === hoverId)) setHoverId(null);
  const hover = items.find((item) => item.id === hoverId);
  // Hover previews take visual priority without changing the persistent selection.
  const emphasis = hoverId ?? selectedId;
  const sectors = items
    .filter((item) => item.count > 0)
    .map((item) => ({ ...item, fill: item.color }));
  // Bound the gap by the smallest real sector, without fabricating a minimum value/angle.
  const paddingAngle =
    sectors.length > 1
      ? Math.min(2, ...sectors.map((item) => (item.percentage * 3.6) / 4))
      : 0;
  function select(id: string) {
    setSelectedId((current) => (current === id ? null : id));
  }
  const percentage = (value: number) => `${value.toFixed(1)}%`;
  return (
    <div
      className="min-w-0 rounded-xl border bg-surface p-4 sm:p-6"
      data-testid="category-distribution"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs tracking-widest text-muted-foreground">
            LINK OVERVIEW
          </p>
          <p className="text-sm text-muted-foreground">
            내가 저장한 링크의 구성
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelectedId(null);
            setHoverId(null);
          }}
        >
          전체 보기
        </Button>
      </div>
      <div className="mt-4 grid min-w-0 items-center gap-6 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1fr)]">
        <div
          className="relative mx-auto h-[280px] w-full max-w-[280px] min-w-0"
          data-testid="donut"
        >
          {total > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={280}
              minWidth={0}
              initialDimension={{ width: 248, height: 248 }}
            >
              <PieChart accessibilityLayer>
                <Pie
                  data={sectors}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="74%"
                  outerRadius="88%"
                  paddingAngle={paddingAngle}
                  cornerRadius={4}
                  stroke="none"
                  isAnimationActive={false}
                  onMouseEnter={(_, index) =>
                    setHoverId(sectors[index]?.id ?? null)
                  }
                  onMouseLeave={() => setHoverId(null)}
                  onClick={(_, index) => {
                    const item = sectors[index];
                    if (item) select(item.id);
                  }}
                  shape={(props) => {
                    const item = sectors[props.index];
                    const active = item?.id === emphasis;
                    const small =
                      Math.abs(props.endAngle - props.startAngle) < 4;
                    return (
                      <Sector
                        cx={props.cx}
                        cy={props.cy}
                        innerRadius={props.innerRadius}
                        outerRadius={props.outerRadius + (active ? 3 : 0)}
                        startAngle={props.startAngle}
                        endAngle={props.endAngle}
                        cornerRadius={small ? 0 : 4}
                        fill={item?.color}
                        stroke={
                          small
                            ? 'none'
                            : active
                              ? 'var(--foreground)'
                              : 'var(--surface)'
                        }
                        strokeWidth={small ? 0 : 1}
                        opacity={!emphasis || active ? 1 : 0.8}
                        data-category-id={item?.id}
                      />
                    );
                  }}
                />
                <Tooltip
                  isAnimationActive={false}
                  content={() =>
                    hover ? (
                      <div
                        role="tooltip"
                        className="max-w-56 rounded-lg border bg-background px-3 py-2 text-xs shadow-sm [overflow-wrap:anywhere]"
                      >
                        {hover.name} · {hover.count.toLocaleString('ko-KR')}개 ·{' '}
                        {percentage(hover.percentage)}
                      </div>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 aspect-square w-[84%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[15px] border-border"
            />
          )}
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[22%] text-center"
            data-testid="donut-center"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="w-full break-words text-3xl font-semibold tabular-nums">
              {(selected?.count ?? total).toLocaleString('ko-KR')}
            </span>
            <span
              className="mt-2 w-full truncate text-sm text-muted-foreground"
              title={selected?.name}
            >
              {selected?.name ?? '전체 링크'}
            </span>
            {selected && (
              <span className="mt-1 text-xs text-muted-foreground">
                {percentage(selected.percentage)}
              </span>
            )}
          </div>
        </div>
        <ul aria-label="카테고리별 링크 수" className="min-w-0 space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                title={item.name}
                aria-pressed={item.id === selectedId}
                onClick={() => select(item.id)}
                onMouseEnter={() => setHoverId(item.id)}
                onMouseLeave={() => setHoverId(null)}
                className={cn(
                  'grid min-h-11 w-full min-w-0 grid-cols-[8px_minmax(0,1fr)_auto_48px] items-center gap-2 rounded-md border border-transparent px-2 text-left text-sm hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  item.id === selectedId &&
                    'border-border bg-surface-raised font-semibold',
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.name}</span>
                <span className="text-right tabular-nums">
                  {item.count.toLocaleString('ko-KR')}
                  <span className="sr-only">개</span>
                </span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  {percentage(item.percentage)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        카테고리를 선택해 비율을 확인하세요.
      </p>
    </div>
  );
}
