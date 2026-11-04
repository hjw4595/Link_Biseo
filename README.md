# LINK BISEO — Frontend

Next.js와 TypeScript 기반으로 개발한 개인 링크 관리 웹 서비스의 프론트엔드 프로젝트입니다.

## Tech Stack

| 구분             | 기술                              | 용도                        |
| ---------------- | --------------------------------- | --------------------------- |
| Framework        | Next.js 16 (App Router), React 19 | 라우팅 및 UI 구성           |
| Language         | TypeScript                        | 타입 안정성                 |
| Styling          | Tailwind CSS 4, shadcn/ui         | 스타일 및 공통 UI           |
| State Management | TanStack Query 5                  | 서버 상태 관리 및 캐싱      |
| Authentication   | Supabase Auth                     | Google OAuth, 이메일 로그인 |
| Visualization    | Recharts                          | 사용 통계 시각화            |
| Testing          | Playwright                        | 기능·통합·브라우저 테스트   |

## Project Structure

```text
src/
├── app/                  # 페이지 및 레이아웃
├── features/             # 기능별 UI 및 로직
│   ├── auth/             # 인증 및 계정
│   ├── links/            # 링크 관리
│   ├── categories/       # 카테고리 관리
│   ├── bookmark-import/  # 북마크 가져오기
│   ├── quick-launch/     # 빠른 실행 프리셋
│   ├── organization/     # 규칙 기반 정리 보고서
│   └── settings/         # 설정 및 통계
├── components/
│   ├── ui/               # 공통 UI 컴포넌트
│   └── common/           # 공통 레이아웃 및 화면 구성
├── contracts/            # API 타입 및 응답 검증
└── lib/
    ├── api/              # API 요청 및 오류 처리
    ├── query/            # Query 및 캐시 관리
    └── supabase/         # 인증 클라이언트

tests/                    # 자동화 테스트
public/                   # 정적 자산
```

## Architecture

Next.js App Router를 기반으로 기능별 UI, 서버 상태 관리, API 통신 계층을 분리했습니다.

```text
Next.js App Router
        │
Feature Components
        │
TanStack Query
        │
API Client / Contracts
        │
NestJS Backend API
```

- **Authentication:** Supabase Auth를 통한 사용자 인증 및 보호된 화면 관리
- **State:** TanStack Query로 서버 데이터를 관리하고 UI 상태는 React에서 처리
- **API:** 공통 클라이언트를 통해 인증 요청, 오류 처리 및 응답 검증
- **Backend:** 별도 NestJS API에서 애플리케이션 데이터 처리

## Key Implementation

### 기능별 코드 구성

인증, 링크, 카테고리, 빠른 실행 등 기능 단위로 UI와 로직을 분리하고 공통 컴포넌트와 API 계층을 별도로 관리합니다.

### 서버 상태 및 캐시 관리

TanStack Query를 사용해 데이터 조회와 갱신을 관리합니다. 사용자별 QueryClient와 Query Key를 분리하여 계정 간 캐시가 섞이지 않도록 구성했습니다.

### 인증 및 API 통신

Supabase Auth와 공통 API Client를 통해 인증 요청과 토큰 갱신, 오류 처리를 관리합니다.

### 반응형 UI

모바일과 데스크톱에 대응하는 반응형 레이아웃을 구성했습니다. 공통 컴포넌트를 활용해 링크 등록·상세·편집을 처리하고, 화면 전환 없이 기존 목록을 유지합니다.

## Testing

Playwright를 활용해 주요 기능과 API 연동, 사용자 상호작용 및 시각적 일관성을 검증했습니다.

| 구분               | 주요 검증 내용                                              |
| ------------------ | ----------------------------------------------------------- |
| 인증 및 세션       | 로그인·로그아웃, 인증 상태 변경, 세션 갱신, 계정 전환       |
| 링크 관리          | 링크 등록·수정·삭제, 검색·필터·정렬, 상세 화면 동작         |
| 카테고리·빠른 실행 | 카테고리 관리 및 순서 변경, 프리셋 구성·편집·실행           |
| 북마크 가져오기    | HTML 파싱, 폴더 매핑, 중복 처리 및 부분 실패                |
| API 및 캐시        | API 응답 검증, 오류 처리, 캐시 갱신, 사용자별 데이터 격리   |
| UI 및 브라우저     | 반응형 레이아웃, Sheet 상호작용, 브라우저별 동작, 시각 회귀 |
