import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CategoryTile } from './category-tile';
import { EmptyState } from '@/components/common/empty-state';

export function CategoryBento({
  categories,
  onAdd,
  home = false,
}: {
  categories: readonly { id: string; name: string }[];
  onAdd?: () => void;
  home?: boolean;
}) {
  const ranked = categories.slice(0, 5);
  if (!ranked.length)
    return (
      <EmptyState
        compact={home}
        title="아직 카테고리가 없어요"
        description="관심 있는 주제를 모아볼까요?"
        action={
          onAdd ? (
            <Button variant="secondary" onClick={onAdd}>
              카테고리 추가하기
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link href="/categories">카테고리 추가하기</Link>
            </Button>
          )
        }
      />
    );
  return (
    <ul
      aria-label="내 카테고리"
      className="grid grid-cols-2 gap-3 lg:grid-cols-3"
    >
      {ranked.map((category, index) => (
        <li
          key={category.id}
          className={
            !home && index === 0
              ? 'row-span-2 min-w-0 lg:row-span-1'
              : 'min-w-0'
          }
        >
          <CategoryTile
            home={home}
            compact
            category={category}
            size={index === 0 ? 'large' : index < 3 ? 'medium' : 'small'}
          />
        </li>
      ))}
    </ul>
  );
}
