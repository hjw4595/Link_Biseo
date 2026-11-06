import { PageLoading } from '@/components/common/page-loading';
export default function Loading() {
  return (
    <PageLoading
      title="비서의 추천"
      text="추천 화면을 불러오고 있어요."
      backHref="/links"
    />
  );
}
