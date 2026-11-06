import {
  ContentSkeleton,
  type ContentSkeletonVariant,
} from './content-skeleton';
import { TopBar } from './top-bar';

export function PageLoading({
  text,
  title,
  backHref,
  variant = 'list',
  compact = false,
}: {
  text: string;
  title?: string;
  backHref?: string;
  variant?: ContentSkeletonVariant;
  compact?: boolean;
}) {
  return (
    <>
      {title && <TopBar title={title} backHref={backHref} heading />}
      <div className="screen-content">
        <ContentSkeleton text={text} variant={variant} compact={compact} />
      </div>
    </>
  );
}
