import { PageLoading } from '@/components/common/page-loading';
export default function Loading() {
  return (
    <PageLoading
      title="링크 상세"
      backHref="/links"
      text="링크를 불러오고 있어요."
      variant="detail"
    />
  );
}
