import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
export const metadata: Metadata = {
  title: '링크비서',
  description:
    '저장한 링크를 쉽게 찾고, 빠르게 실행하고, 필요할 때 정리하는 링크 관리 서비스.',
};
type RootLayoutProps = { children: ReactNode };
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
