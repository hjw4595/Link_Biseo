'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

export function SettingsFaq() {
  const search = useSearchParams();
  const popupRequested = search.get('faq') === 'popup';
  const popupTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!popupRequested) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById('faq-popup')?.scrollIntoView({ block: 'start' });
      popupTrigger.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [popupRequested]);
  return (
    <section aria-labelledby="settings-faq-heading" className="space-y-3">
      <h2 id="settings-faq-heading" className="font-semibold">
        자주 묻는 질문
      </h2>
      <Accordion
        key={popupRequested ? 'popup' : 'closed'}
        type="single"
        collapsible
        defaultValue={popupRequested ? 'popup' : undefined}
        className="surface-card divide-y"
      >
        <AccordionItem value="popup" id="faq-popup" className="scroll-mt-24">
          <AccordionTrigger ref={popupTrigger}>
            빠른 실행에서 링크가 하나만 열려요.
          </AccordionTrigger>
          <AccordionContent>
            <p>브라우저가 여러 탭을 팝업으로 보고 일부를 차단할 수 있어요.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Chrome에서 링크비서 페이지를 열어 주세요.</li>
              <li>
                주소창 왼쪽의 사이트 정보에서 사이트 설정을 선택해 주세요.
              </li>
              <li>팝업 및 리디렉션을 허용으로 변경해 주세요.</li>
              <li>링크비서를 새로고침한 뒤 빠른 실행을 다시 눌러 주세요.</li>
            </ol>
            <p className="mt-2">
              이미 열린 탭이 있다면 다시 실행할 때 중복으로 열릴 수 있어요.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="remember">
          <AccordionTrigger>팝업 허용은 매번 해야 하나요?</AccordionTrigger>
          <AccordionContent>
            같은 브라우저 프로필에서는 링크비서 사이트에 한 번 허용하면 설정이
            저장돼요. 다른 브라우저나 프로필을 사용하거나 사이트 권한을
            초기화하면 다시 설정해야 해요.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="links">
          <AccordionTrigger>
            다른 링크를 추가하면 다시 허용해야 하나요?
          </AccordionTrigger>
          <AccordionContent>
            아니요. 팝업 허용은 링크를 여는 출발 사이트인 링크비서에 적용돼요.
            빠른 실행에 다른 링크를 추가해도 다시 허용할 필요는 없어요. 회사
            보안 정책이나 별도 차단 확장 프로그램에 따라 실행이 제한될 수
            있어요.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="incognito">
          <AccordionTrigger>시크릿 실행은 어떻게 사용하나요?</AccordionTrigger>
          <AccordionContent>
            <p>
              PC Chrome에서 링크비서 확장 프로그램이 연결되고 시크릿 권한이
              허용되어야 해요. 연결되면 상단 시크릿 토글을 켠 뒤 링크나 빠른
              실행을 눌러 주세요.
            </p>
            <p className="mt-2">
              권한 안내가 나오면 Chrome 확장 프로그램 관리에서 링크비서의
              세부정보를 열고 시크릿 모드에서 허용을 켜 주세요. 확장 프로그램은
              웹 스토어 배포 준비 중이며, 연결되지 않은 경우 시크릿 실행을
              사용할 수 없어요.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
