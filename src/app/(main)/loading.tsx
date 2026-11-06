import { TopBar } from '@/components/common/top-bar';
import { LinkListSkeleton } from '@/features/links/components/link-skeleton';
export default function Loading() {
  return (
    <>
      <TopBar title="홈" />
      <div className="screen-content">
        <section className="space-y-3" aria-labelledby="loading-favorites">
          <h2 id="loading-favorites" className="font-semibold">
            즐겨찾기
          </h2>
          <LinkListSkeleton
            count={6}
            compact
            grid
            text="즐겨찾기를 불러오고 있어요."
          />
        </section>
      </div>
    </>
  );
}
