import { ContentSkeleton } from '@/components/common/content-skeleton';
export function CategoryBentoSkeleton({ text }: { text: string }) {
  return <ContentSkeleton text={text} variant="cards" count={4} />;
}
export function CategoryListSkeleton({ text }: { text: string }) {
  return <ContentSkeleton text={text} variant="cards" count={3} />;
}
