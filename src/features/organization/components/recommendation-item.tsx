'use client';
import { useId, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RecommendationItem as Item } from '../types';
import { RecommendationDetail } from './recommendation-detail';

export function RecommendationItem({ item }: { item: Item }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="min-w-0 space-y-4 rounded-xl border bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        <ListChecks
          className="mt-1 size-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h2
            id={`${id}-title`}
            className="text-list font-semibold [overflow-wrap:anywhere]"
          >
            {item.title}
          </h2>
          <p className="text-meta leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {item.description}
          </p>
          <p className="text-sm">
            {item.count === null
              ? item.status === 'loading'
                ? '준비 중'
                : '확인 불가'
              : `${item.count}개`}
          </p>
        </div>
      </div>
      <Button
        variant="secondary"
        className="h-auto min-h-11 max-w-full whitespace-normal text-left"
        aria-expanded={expanded}
        aria-controls={`${id}-detail`}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? '접기' : item.action}
      </Button>
      <div id={`${id}-detail`} hidden={!expanded}>
        {expanded && <RecommendationDetail item={item} />}
      </div>
    </section>
  );
}
