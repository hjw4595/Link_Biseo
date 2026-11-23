# LINK BISEO — Frontend

Next.js와 TypeScript 기반으로 개발한 개인 링크 관리 웹 서비스의 프론트엔드 프로젝트입니다.

## Tech Stack

| 구분             | 기술                                    | 용도                        |
| ---------------- | --------------------------------------- | --------------------------- |
| Framework        | Next.js 16.4.6 (App Router), React 19.3 | 라우팅 및 UI 구성           |
| Language         | TypeScript                              | 타입 안정성                 |
| Styling          | Tailwind CSS 4, shadcn/ui               | 스타일 및 공통 UI           |
| State Management | TanStack Query 5                        | 서버 상태 관리 및 캐싱      |
| Authentication   | Supabase Auth                           | Google OAuth, 이메일 로그인 |
| Visualization    | Recharts                                | 사용 통계 시각화            |
| Testing          | Playwright                              | 기능·통합·브라우저 테스트   |

Next.js와 `eslint-config-next`는 보안 수정이 포함된 `16.4.6`으로 고정합니다. [공식 보안 공지](https://nextjs.org/blog/november-2026-security-release)의 수정 버전 이후 패치를 적용했습니다. 개발 도구의 취약한 간접 의존성도 갱신하도록 `typescript-eslint`를 `8.73.0`으로 업데이트했으며, 정확한 의존성 버전은 `pnpm-lock.yaml`로 관리합니다. 운영 반영에는 의존성 설치 후 재빌드·재배포가 필요합니다.

## Project Structure

```text
src/
├── app/                  # 라우팅, 레이아웃, 인증 및 URL 파라미터 처리
├── screens/              # 페이지별 화면 구성과 전용 기능
│   ├── home/             # 즐겨찾기, 홈 추천 및 상세 Sheet 조합
│   ├── links/            # 내 링크 화면, 필터 및 import/ 가져오기
│   ├── categories/       # 카테고리 관리 및 detail/ 카테고리별 링크
│   ├── settings/         # account/, statistics/, preferences/, faq/
│   ├── organization/     # 정리 보고서 및 recommendations/
│   ├── login/            # 로그인 화면과 폼
│   ├── diagnostics/      # API 연결 진단
│   └── dev/              # 개발용 UI 및 동작 미리보기
├── features/             # 여러 화면이 공유하는 기능과 서버 상태
│   ├── auth/             # 인증, 세션 및 계정 검증 Query
│   ├── links/            # registration/, detail/, 공유 목록·실행 및 query/
│   ├── categories/       # 카테고리 API Query와 규칙
│   ├── quick-launch/     # 빠른 실행 프리셋 기능
│   ├── link-launch/      # 공통 실행 모드 및 실행 제어
│   ├── organization/     # 정리 보고서 Query와 공통 변환
│   └── settings/         # 사용 통계 Query와 캐시
├── components/
│   ├── ui/               # 공통 UI 컴포넌트
│   └── common/           # 공통 레이아웃 및 화면 구성
├── contracts/            # API 타입 및 응답 검증
└── lib/
    ├── api/              # 인증 요청, 공통 응답 검증 및 오류 처리
    ├── query/            # 사용자별 QueryClient 및 요청 수명 관리
    └── supabase/         # 인증 클라이언트

tests/                    # 자동화 테스트
public/                   # 정적 자산
```

## Architecture

Next.js App Router의 라우트 처리, 페이지별 화면 구성, 공유 기능, API 통신 계층을 분리했습니다.

```text
Next.js App Router
        │
Page Screens
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

화면 전용 구성과 동작은 `screens/<페이지>` 안에서 기능별로 묶습니다. 여러 화면에서 쓰는 링크 등록·상세·실행과 서버 상태는 `features`에서 공유하고, 범용 UI는 `components`에 둡니다.

- `app`: 인증 확인, URL 파라미터, 리다이렉트와 라우트 fallback을 담당합니다. 직접 등록·상세 라우트는 공유 feature 화면을 사용합니다.
- `screens`: 페이지를 조합하고 해당 페이지에서만 쓰는 UI와 동작을 관리합니다. 북마크 파서와 실행 흐름도 `screens/links/import`에 함께 둡니다.
- `features`: 여러 화면이 쓰는 기능과 도메인별 서버 상태를 관리합니다. `features`, `lib`, 공통 UI는 `screens`를 참조하지 않습니다.
- `components`: 범용 UI와 공통 레이아웃을 제공합니다. 공통 취소·저장 버튼은 `action-buttons.tsx`를 사용하며, 배치와 크기는 부모가 결정합니다.

### 링크 등록과 상세 Sheet

`features/links/components/add-link-form.tsx`는 등록 UI를 조합하고, `registration/`의 훅이 저장, URL 미리보기, 카테고리 선택·생성, 이탈 확인을 나눠 담당합니다.

`features/links/components/link-detail.tsx`는 직접 접근과 Sheet 진입을 공유합니다. `detail/`에서 조회·저장·삭제·URL 복사와 확인 대화상자·포커스 복원을 관리하고, 편집 초안은 기존 `useLinkEditor`가 담당합니다. 상세 Sheet에는 정보 확인·수정·삭제·URL 복사를 제공하며, 사이트 실행은 목록에서 수행합니다.

### 서버 상태 및 캐시 관리

TanStack Query를 사용해 데이터 조회와 갱신을 관리합니다. 사용자별 QueryClient와 Query Key를 분리하여 계정 간 캐시가 섞이지 않도록 구성했습니다.

Query 훅, 키와 캐시 갱신은 `features/<기능>/query/`에서 관리합니다. 링크 관련 공통 갱신은 `features/links/query/cache.ts`를 재사용하고, `lib/query/provider.tsx`는 사용자별 QueryClient와 요청 취소 수명만 담당합니다.

### 인증 및 API 통신

Supabase Auth와 공통 API Client를 통해 인증 요청과 토큰 갱신, 오류 처리를 관리합니다.

`lib/api/response.ts`에서 HTTP 상태와 응답 본문을 검증하고 `ApiRequestError`로 오류를 통일합니다. 사용자에게 보여줄 오류 문구는 각 feature의 `errors.ts`에서 관리합니다. 애플리케이션 데이터는 `Next.js → NestJS → Database / external services` 경로를 따르며, 백엔드와 DB 마이그레이션은 별도 `biseo_BE` 저장소에서 관리합니다.

### 반응형 UI

모바일과 데스크톱에 대응하는 반응형 레이아웃을 구성했습니다. 공통 컴포넌트를 활용해 링크 등록·상세·편집을 처리하고, 화면 전환 없이 기존 목록을 유지합니다.

모든 페이지는 `components/common/app-layout-policy.ts`의 공통 너비 정책(기본 최대 512px, md부터 768px, lg부터 1152px)을 따릅니다. 내비게이션은 lg 미만에서 하단, lg 이상에서 상단에 표시하며 Sheet와 대화상자는 별도의 크기 정책을 유지합니다.

## Getting Started

Node.js 22.14 이상과 pnpm 10을 사용합니다. 저장소 루트에서 의존성을 설치하고 `.env.example`을 `.env.local`로 복사한 뒤 Supabase 공개 인증 설정과 별도 NestJS API 주소를 입력합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다. 환경 변수와 운영 인증 설정은 아래 배포 안내를 참고하세요.

## Testing

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Playwright는 로컬 모의 인증·API 서버와 3100번 포트의 Next.js 개발 서버를 실행합니다. 브라우저가 설치되지 않았다면 `pnpm exec playwright install chromium`을 먼저 실행합니다. 실제 Google OAuth와 운영 확장 연동은 별도로 확인해야 합니다.

개발 검증에 사용하는 `/dev/ui`와 `?preview=cleanup` 화면은 기본적으로 비활성화됩니다. 로컬에서 필요한 경우에만 서버 환경 변수 `ENABLE_DEV_PREVIEWS=true`를 설정합니다. 운영에서는 이 설정과 관계없이 데모를 표시하지 않습니다. Playwright 서버는 기존 UI 회귀 검증을 위해 해당 설정을 명시적으로 켭니다. 기본 비활성 상태를 검증하려면 `ENABLE_DEV_PREVIEWS=false`로 `tests/dev-previews.spec.ts`를 실행합니다.

| 구분               | 주요 검증 내용                                              |
| ------------------ | ----------------------------------------------------------- |
| 인증 및 세션       | 로그인·로그아웃, 인증 상태 변경, 세션 갱신, 계정 전환       |
| 링크 관리          | 링크 등록·수정·삭제, 검색·필터·정렬, 상세 화면 동작         |
| 카테고리·빠른 실행 | 카테고리 관리 및 순서 변경, 프리셋 구성·편집·실행           |
| 북마크 가져오기    | HTML 파싱, 폴더 매핑, 중복 처리 및 부분 실패                |
| API 및 캐시        | API 응답 검증, 오류 처리, 캐시 갱신, 사용자별 데이터 격리   |
| UI 및 브라우저     | 반응형 레이아웃, Sheet 상호작용, 브라우저별 동작, 시각 회귀 |

## Deployment and Extension Verification

시크릿 실행은 연결된 Chrome 확장의 PING 및 GET_STATUS 검증 후에만 켜집니다.
확장 미연결 시에는 **확장 프로그램 배포 준비 중** 안내와 확인 버튼만 표시합니다.
시크릿 권한 거부와 타임아웃·프로토콜 오류는 기존 권한·연결 오류 안내를 유지합니다.
설치 링크나 일반 실행으로의 자동 대체는 제공하지 않습니다.

스토어 배포 전 운영 테스트는 `biseo_ex`의 `.output/chrome-mv3`를 같은 Chrome
프로필·경로에서 새로고침해 진행합니다. FE 빌드 환경의
`NEXT_PUBLIC_BISEO_EXTENSION_ID`는 설치된 확장 ID와 일치해야 합니다.
이 값은 빌드 시 반영되므로 운영 FE를 다시 빌드·배포해야 합니다.
확장은 localhost:3000·3003 및 운영 Cloud Run Origin만 명시적으로 허용합니다.

Cloud Run 운영 인증 리다이렉션에는 서버 런타임 환경 변수
`APP_ORIGIN=https://biseo-web-387226361382.asia-northeast3.run.app`이 필요합니다.
정확한 HTTPS Origin만 설정하며 경로는 포함하지 않습니다. 콜백과 Proxy는
`X-Forwarded-Host`(없으면 `Host`)를 이 값과 대조하고, 전달된 프로토콜이 있으면
HTTPS인지 확인합니다. 설정 누락 또는 잘못된 요청 Host는 HTTP 400으로 거절합니다.
로컬 개발에는 추가 설정이 필요하지 않습니다.

새 FE를 빌드·재배포할 때 이 환경 변수를 함께 설정하고, Supabase Auth의 허용
Redirect URL에 운영 주소의 `/auth/callback`이 등록되어 있는지 확인합니다.
재배포 후 실제 Google 계정으로 최초 로그인·즉시 세션 인식·로그아웃 후 재로그인을
확인해야 합니다. PKCE와 쿠키 처리 및 이메일 인증 방식은 유지합니다.
