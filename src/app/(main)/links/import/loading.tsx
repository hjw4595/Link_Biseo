import { PageLoading } from '@/components/common/page-loading';
export default function Loading() {
  return (
    <PageLoading
      title="북마크 가져오기"
      text="가져오기 화면을 불러오고 있어요."
      variant="form"
      backHref="/links"
    />
  );
}
