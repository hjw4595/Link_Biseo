'use client';
import { useStore } from 'zustand';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
} from '@/components/ui/alert-dialog';
import { useLaunch } from './provider';
import { IncognitoIcon } from './incognito-icon';
import { NoticeDialog } from '@/components/common/notice-dialog';

export function LaunchToggle() {
  const controller = useLaunch();
  return controller ? <Toggle controller={controller} /> : null;
}
function Toggle({
  controller,
}: {
  controller: NonNullable<ReturnType<typeof useLaunch>>;
}) {
  const { store, check, off } = controller;
  const mode = useStore(store, (state) => state.mode);
  const connection = useStore(store, (state) => state.extensionConnection);
  const permission = useStore(store, (state) => state.incognitoPermission);
  const notice = useStore(store, (state) => state.notice);
  const checking = connection === 'checking';
  const denied = permission === 'denied';
  const unavailable = connection === 'unavailable';
  return (
    <div className="hidden lg:block">
      <Button
        type="button"
        role="switch"
        aria-checked={mode === 'incognito'}
        aria-label="시크릿 실행 모드"
        aria-busy={checking || undefined}
        variant={mode === 'incognito' ? 'secondary' : 'ghost'}
        size="sm"
        className={`w-32 whitespace-nowrap border transition-none ${mode === 'incognito' ? '' : 'border-transparent'}`}
        onClick={() => {
          if (mode === 'incognito' || checking) off();
          else void check();
        }}
      >
        <span className="flex size-[18px] shrink-0 items-center justify-center">
          {checking ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-[18px] animate-spin motion-reduce:animate-none"
            />
          ) : (
            <IncognitoIcon />
          )}
        </span>
        <span>시크릿</span>
        <span className="w-7 shrink-0 text-center">
          {mode === 'incognito' ? 'ON' : 'OFF'}
        </span>
      </Button>
      {checking && (
        <span role="status" className="sr-only">
          확장 프로그램과 권한을 확인하고 있어요. 다시 누르면 취소해요.
        </span>
      )}
      <NoticeDialog
        open={notice !== null && unavailable}
        onOpenChange={(open) => {
          if (!open) store.getState().update({ notice: null });
        }}
        title="확장 프로그램 배포 준비 중"
        description={
          <>
            Chrome 확장 프로그램을 준비하고 있어요.
            <br />
            배포가 완료되면 시크릿 창에서 링크를 실행할 수 있습니다.
          </>
        }
      />
      <AlertDialog
        open={notice !== null && !unavailable}
        onOpenChange={(open) => {
          if (!open) store.getState().update({ notice: null });
        }}
      >
        <AlertDialogContent
          title={
            denied
              ? '시크릿 모드 허용이 필요합니다.'
              : 'Chrome 확장 프로그램을 연결할 수 없습니다.'
          }
          description={
            <div className="space-y-3">
              <p>
                {denied
                  ? 'Chrome에서 직접 권한을 변경해 주세요.'
                  : '시크릿 실행을 사용하려면 링크비서 확장 프로그램이 필요합니다.'}
              </p>
              <p>{notice}</p>
              {denied ? (
                <ol className="list-decimal pl-5">
                  <li>Chrome 주소창에 chrome://extensions 입력</li>
                  <li>링크비서 확장 프로그램 세부정보 선택</li>
                  <li>시크릿 모드에서 허용 활성화</li>
                  <li>링크비서로 돌아와 연결 확인</li>
                </ol>
              ) : (
                <p>
                  동일 Chrome 프로필의 확장 활성화 여부, 확장 ID 설정과 웹앱
                  주소를 확인해 주세요. 연결 실패가 반드시 미설치를 의미하지는
                  않아요.
                </p>
              )}
            </div>
          }
        >
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button variant="ghost">닫기</Button>
            </AlertDialogCancel>
            <Button
              onClick={() => {
                void check();
              }}
            >
              연결 확인
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
