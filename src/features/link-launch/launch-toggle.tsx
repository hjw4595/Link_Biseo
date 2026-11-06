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
  const installUrl = process.env.NEXT_PUBLIC_BISEO_EXTENSION_INSTALL_URL;
  const safeInstall = installUrl?.startsWith(
    'https://chromewebstore.google.com/',
  )
    ? installUrl
    : null;
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
      <AlertDialog
        open={notice !== null}
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
                <>
                  {safeInstall ? (
                    <a
                      href={safeInstall}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline"
                    >
                      확장 프로그램 설치
                    </a>
                  ) : (
                    <p>
                      웹 스토어 설치 링크는 준비 중이에요. 개발 환경에서는
                      biseo_ex에서 빌드한 .output/chrome-mv3 폴더를 Chrome 확장
                      프로그램 관리의 개발자 모드 → 압축해제된 확장 프로그램을
                      로드합니다로 설치해 주세요.
                    </p>
                  )}
                  <p>
                    동일 Chrome 프로필의 확장 활성화 여부, 확장 ID 설정과 웹앱
                    주소를 확인해 주세요. 연결 실패가 반드시 미설치를 의미하지는
                    않아요.
                  </p>
                </>
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
