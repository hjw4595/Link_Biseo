import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type CategoryTileProps = {
  category: { id: string; name: string };
  size?: 'large' | 'medium' | 'small';
  compact?: boolean;
  home?: boolean;
};
export function CategoryTile({
  category,
  size = 'small',
  compact = false,
  home = false,
}: CategoryTileProps) {
  const style =
    size === 'large'
      ? `${compact ? 'min-h-46' : 'min-h-52'} bg-accent-subtle text-2xl`
      : size === 'medium'
        ? `${compact ? 'min-h-21.5' : 'min-h-24'} bg-tile-medium text-lg`
        : 'min-h-20 bg-surface text-list';
  return (
    <Link
      href={`/category/${category.id}`}
      data-size={size}
      title={category.name}
      className={cn(
        'flex h-full min-w-0 rounded-lg border border-transparent p-4 font-medium hover:border-border',
        home
          ? 'min-h-20 items-center gap-3 bg-tile-medium text-list'
          : `flex-col justify-between ${compact ? 'gap-2 lg:min-h-24 lg:text-base' : 'gap-5'} ${style}`,
      )}
    >
      <ArrowUpRight
        className={
          home
            ? 'order-2 size-4 shrink-0 text-muted-foreground'
            : 'size-4 self-end text-muted-foreground'
        }
        aria-hidden="true"
      />
      <span
        className={`${compact ? 'line-clamp-2' : ''} ${home ? 'min-w-0 flex-1' : ''} break-words [overflow-wrap:anywhere]`}
      >
        {category.name}
      </span>
    </Link>
  );
}
