import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { RecommendationItem } from '../types';

export function RecommendationDetail({ item }: { item: RecommendationItem }) {
  if (item.status !== 'ready')
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {item.description}
      </p>
    );
  return (
    <div className="space-y-3">
      <p className="text-meta text-muted-foreground">
        전체 {item.count}개 중 {item.previewItems.length}개 표시
      </p>
      <ul className="divide-y rounded-lg border">
        {item.previewItems.map((link) => (
          <li key={link.id}>
            <Link
              href={`/links/${link.id}`}
              prefetch={false}
              className="flex min-h-16 items-center gap-3 px-3 py-3 hover:bg-secondary"
            >
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-sm font-medium [overflow-wrap:anywhere]">
                  {link.title}
                </span>
                <span className="block text-meta text-muted-foreground [overflow-wrap:anywhere]">
                  {link.domain}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-meta leading-relaxed text-muted-foreground">
        보고서에 포함된 {item.returnedCount}개 중 일부를 보여드려요.
        {item.truncated && ' 분석 시점의 전체 항목 중 일부예요.'} 수정과 삭제는
        링크 상세에서 직접 확인한 뒤 진행해 주세요.
      </p>
    </div>
  );
}
