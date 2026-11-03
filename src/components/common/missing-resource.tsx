import Link from 'next/link';
import { TopBar } from './top-bar';
import { EmptyState } from './empty-state';
import { Button } from '@/components/ui/button';

export function MissingResource({ kind = '페이지' }: { kind?: string }) {
  return (
    <>
      <TopBar title="링크비서" brand backHref="/" />
      <div className="screen-content">
        <EmptyState
          title={`${kind}를 찾을 수 없어요`}
          description="주소를 확인해주세요. 삭제되었거나 접근할 수 없는 항목일 수 있어요."
          action={
            <Button asChild variant="secondary">
              <Link href="/">홈으로 돌아가기</Link>
            </Button>
          }
        />
      </div>
    </>
  );
}
