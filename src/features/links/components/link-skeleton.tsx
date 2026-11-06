import { ContentSkeleton } from '@/components/common/content-skeleton';
export function LinkListSkeleton({
  text,
  count = 4,
  grid = false,
  compact = false,
}: {
  text: string;
  count?: number;
  grid?: boolean;
  compact?: boolean;
}) {
  return (
    <ContentSkeleton text={text} count={count} grid={grid} compact={compact} />
  );
}
export function LinkDetailSkeleton({ text }: { text: string }) {
  return <ContentSkeleton text={text} variant="detail" />;
}
