import { PageLoading } from '@/components/common/page-loading';

export default function Loading() {
  return (
    <PageLoading
      title="카테고리"
      text="카테고리를 불러오고 있어요."
      variant="cards"
    />
  );
}
