import { PageLoading } from '@/components/common/page-loading';

export default function Loading() {
  return (
    <PageLoading
      title="카테고리"
      backHref="/categories"
      text="카테고리의 링크를 불러오고 있어요."
    />
  );
}
