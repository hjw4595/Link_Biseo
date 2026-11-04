# LINK BISEO — Frontend

개인 링크 관리 서비스 LINK BISEO의 Next.js 프론트엔드 저장소입니다. 인증은 Supabase Auth를 사용하고, 애플리케이션 데이터는 별도 NestJS 백엔드를 통해 조회·저장합니다.

## Tech Stack

버전은 `pnpm-lock.yaml`에 고정된 값을 기준으로 합니다.

| 기술                 | 버전                             | 역할                                                            |
| -------------------- | -------------------------------- | --------------------------------------------------------------- |
| Next.js App Router   | 16.4.3                           | 파일 기반 라우팅, Layout, 서버 인증 가드, OAuth Callback, Proxy |
| React / React DOM    | 19.3.0                           | 기능별 화면 구성과 입력·선택·Sheet 로컬 상태                    |
| TypeScript           | 5.9.3                            | `strict`, `noUncheckedIndexedAccess`를 적용한 타입 검사         |
| Tailwind CSS         | 4.3.3                            | 전역 디자인 토큰, 반응형 레이아웃과 스타일                      |
| shadcn/ui / Radix UI | 저장소 내 UI 코드 / Radix 1.8.1  | Button·Input·Sheet·Dialog 등 공통 UI primitives                 |
| TanStack Query       | 5.104.2                          | 사용자별 서버 상태 캐시, 커서 페이지네이션, Mutation 후 갱신    |
| Supabase Auth        | supabase-js 2.117.3 / ssr 0.12.7 | Google OAuth·이메일 로그인, 쿠키 기반 세션과 사용자 검증        |
| Recharts             | 3.10.1                           | 설정 화면의 카테고리 분포 차트                                  |
| Lucide React         | 0.468.0                          | 공통 아이콘                                                     |
| Playwright Test      | 1.64.0                           | 순수 로직·Mock API·브라우저 상호작용·시각 회귀 검증             |
| ESLint / Prettier    | 9.39.5 / 3.9.10                  | 코드 규칙과 포맷 검사                                           |

## Project Structure

루트에 단일 pnpm 관리 Next.js 앱을 둡니다. 백엔드와 DB 마이그레이션은 별도 `biseo_BE` 저장소에서 관리합니다.

```text
src/
  app/                   App Router 페이지, Layout, 전역 스타일
    (main)/              인증이 필요한 서비스 화면
    auth/callback/       OAuth 코드 교환
    login/               공개 로그인 화면
    diagnostics/         공개 API 진단 화면
    dev/                 개발 전용 UI 미리보기
  features/
    auth/                인증 초기화, 계정, 로그인·로그아웃
    categories/          카테고리 관리
    links/               링크 목록·등록·상세·열기, 검색 조건
    bookmark-import/     북마크 HTML 파싱·중복 확인·가져오기
    quick-launch/        프리셋 편집·정렬·여러 링크 실행
    organization/        규칙 기반 정리 보고서와 화면 Adapter
    settings/            통계·카테고리 분포 표시
  components/
    ui/                  재사용 UI primitives
    common/              AppShell, Navigation, AppSheet, 공통 상태 UI
  contracts/             공개 HTTP 타입과 응답 런타임 검증
  lib/
    api/                 공통 인증 요청과 기능별 API 호출
    query/               QueryClient, Query Key, 조회·Mutation 훅
    supabase/            브라우저·서버·Proxy 인증 클라이언트
    mock/                개발 미리보기용 메모리 데이터
  proxy.ts               요청 단계의 세션 확인·쿠키 갱신
tests/                   Playwright 테스트, Mock 서버, fixtures, 기준 이미지
scripts/                 브랜드 아이콘 생성·선택적 개발 검증 도구
public/                  정적 이미지와 브랜드 자산
docs/                    제품·아키텍처 문서와 개발 이력
```

## Architecture

루트 Layout은 문서와 전역 스타일을 구성합니다. 보호된 `(main)` Layout은 서버의 `verifiedUser()`로 Supabase `getUser()` 검증을 수행하고, 검증되지 않은 사용자를 로그인 화면으로 보냅니다. Proxy도 요청 단계에서 사용자를 확인하고 갱신된 쿠키를 요청·응답에 반영합니다.

브라우저의 `AuthProvider`는 인증 초기화·인증됨·미인증·오류 상태를 관리하고 Auth 이벤트와 창 포커스에서 사용자를 다시 검증합니다. 인증이 확인된 뒤 사용자 ID로 구분한 `UserQueryProvider`와 공통 `AppShell`을 마운트합니다. 이 인증 초기화는 기능 데이터 조회와 별도입니다.

일반 기능 데이터는 다음 책임을 따라 흐릅니다.

```text
features의 화면·훅
  → lib/query의 Query·Mutation
  → lib/api의 기능별 API 함수
  → authenticatedRequest → 별도 NestJS API → DB·외부 서비스

API 응답 → 기능별 API 함수에서 contracts 검증 → Query 캐시 → 화면
```

공개 HTTP 계약은 `src/contracts`에 두고 DB 모델과 분리합니다. API 함수는 JSON 응답을 `unknown`으로 받아 타입 가드로 검증하며, 필요한 경우 요청한 사용자·링크 ID·시간대와 응답의 일치 여부도 확인합니다. 프론트엔드는 Supabase 테이블에 애플리케이션 데이터를 직접 쓰지 않습니다. DB 접근과 OpenAI 호출은 별도 백엔드의 책임입니다.

현재 `organization` 화면은 백엔드의 결정적 규칙 기반 정리 보고서를 사용합니다. 생성형 AI를 통한 외부 링크 발견이나 자동 AI 추천 피드가 구현된 것으로 표현하지 않습니다.

반응형 컨테이너는 공통 폭 정책으로 중앙 정렬하며, Compact 화면은 최대 512px입니다. Navigation은 `lg` 미만 하단, `lg` 이상 상단에 배치합니다. 링크 등록·상세·편집은 공통 AppSheet를 사용해 배경 목록을 유지하고, 패널은 모바일 전체 폭·높이, 데스크톱 최대 512px로 표시합니다.

## Design Decisions

### Feature-based Organization

화면과 도메인 로직은 `features`에 모으고, 공통 UI는 `components/ui`, 화면 간 공통 구성은 `components/common`에 둡니다. 기능을 수정할 때 관련 코드를 찾기 쉽고, 공통 표현과 도메인 동작의 변경 범위를 구분할 수 있습니다.

인증 요청 정책은 `lib/api/client.ts`, 데이터 조회와 갱신은 `lib/query`에서 공유합니다. 기능 컴포넌트마다 토큰 처리나 캐시 정책을 중복 구현하지 않습니다. `organization`·`settings`의 Adapter는 검증된 API 응답을 화면 표현으로 변환합니다.

### Server State & Client State

서버 상태는 TanStack Query가 관리합니다. 인증된 사용자마다 QueryClient를 생성하고 Query Key에도 사용자 ID를 포함합니다. 목록 키는 검색 조건을, 사용 통계 키는 시간대·장치 날짜를 포함합니다. 사용자 트리가 해제되면 요청 범위를 중단하고 Query를 취소·정리해 이전 계정의 캐시를 재사용하지 않습니다.

기본 Query 설정은 `staleTime: 15000`, `retry: false`, `refetchOnWindowFocus: false`이고 Mutation도 자동 재시도하지 않습니다. 개별 기능은 목적에 따라 이를 재정의합니다.

| 대상                                 | 개별 정책                                              |
| ------------------------------------ | ------------------------------------------------------ |
| 링크 미리보기                        | `staleTime` 5분                                        |
| 링크 일별 통계·정리 후보·사용자 설정 | `staleTime: 0`, 마운트 시 항상 갱신, 포커스 시 갱신    |
| 계정 사용 통계                       | 기본 `staleTime` 유지, 포커스 갱신, 시간대·날짜별 캐시 |

Mutation 성공 후 관련 목록·요약·상세를 갱신합니다. 링크 수정은 검증된 서버 응답을 상세 캐시에 넣고, 삭제는 상세·통계 캐시를 제거합니다. 링크 열기 성공은 후속 GET을 기다리지 않으며, 계정 사용 통계는 stale 표시만 해 다음 진입·포커스 시 갱신합니다. 정리 보고서는 별도 stale·revision 정보로 스냅샷을 관리합니다.

입력 초안·선택·Sheet 열림 상태는 React 로컬 상태로 관리합니다. 내 링크의 `q`, `categoryId`, `favorite`, `sort`는 URL과 동기화하며, `history.replaceState`와 `useSearchParams`로 뒤로 가기·직접 접근 시 조건을 복원합니다. 전역 Store 없이 서버 상태와 일시적 화면 상태의 소유권을 나눕니다.

### Authentication & API Boundary

Supabase SSR SDK의 브라우저·서버 클라이언트를 공유하고 세션은 SDK가 쿠키로 관리합니다. 쿠키는 `SameSite=Lax`, 운영 환경에서는 `Secure`를 사용하며 SDK 동작을 위해 브라우저에서도 읽을 수 있습니다. 별도의 토큰 저장소를 만들지 않습니다. 보호 화면의 접근 권한은 쿠키 내용만으로 판단하지 않고 `getUser()`로 검증합니다.

공통 `authenticatedRequest`는 현재 세션의 Access Token을 Bearer 헤더로 전달하고, 요청 전후 사용자 ID를 확인합니다. 기본적으로 401에서 한 번 세션을 갱신해 재요청하며, 프리셋 쓰기·가져오기 등 일부 호출은 이 재시도를 끕니다. 네트워크 오류가 난 쓰기는 자동 재전송하지 않습니다.

요청은 `cache: 'no-store'`, `credentials: 'omit'`, `redirect: 'error'`를 사용합니다. 기본 10초의 fetch 타임아웃과 호출자가 전달한 AbortSignal을 결합하고, 인증·권한·네트워크·서버·응답 검증·타임아웃·취소 오류를 구분합니다. 잘못된 응답을 정상 데이터나 Mock 데이터로 바꾸지 않습니다.

## Getting Started

### 실행 환경

- Node.js **22.14.0 이상**, 권장 **24** (`.node-version`)
- pnpm **10.34.7** (`packageManager`; engines 범위는 `>=10 <11`)

모든 명령은 저장소 루트에서 실행합니다.

```sh
pnpm install --frozen-lockfile
```

### 환경변수와 백엔드 연결

`.env.example`을 `.env.local`로 복사하고 값을 설정합니다. PowerShell에서는 다음 명령을 사용할 수 있습니다.

```powershell
Copy-Item .env.example .env.local
```

| 변수                                   | 필수 여부               | 용도                                                      |
| -------------------------------------- | ----------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                  | 실제 데이터 기능에 필수 | 브라우저에서 접근 가능한 별도 NestJS API 주소             |
| `NEXT_PUBLIC_SUPABASE_URL`             | 실제 로그인에 필수      | Supabase Auth 프로젝트 URL                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 키 중 하나 필수    | 기본 공개 publishable 키                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | 선택, 대체 키           | legacy 공개 anon 키. publishable 키가 있으면 그 키가 우선 |

`NEXT_PUBLIC_*` 값은 브라우저에 공개되고 빌드에 포함됩니다. DB 비밀번호·service-role 키·OpenAI 비밀키는 설정하지 않습니다. 공개 환경설정 변경 후 개발 서버를 재시작하고 운영용 빌드는 다시 생성합니다.

실제 로그인과 링크·카테고리·프리셋·정리·통계 기능에는 Supabase Auth 및 별도 NestJS API가 필요합니다. FE와 BE는 같은 Supabase 프로젝트를 사용하고, 백엔드의 허용 웹 origin을 FE 주소와 맞춥니다. 백엔드 실행·DB 마이그레이션은 해당 저장소의 문서를 따릅니다.

Google 로그인은 Supabase Google Provider와 웹 `/auth/callback` Redirect URL 설정이 필요합니다. Google 측 Redirect URI는 Supabase `/auth/v1/callback`입니다. 이메일 로그인에는 Email Provider와 확인된 계정이 필요합니다. [로컬 연결 안내](docs/LOCAL_API.md)의 현재 안내 부분을 참고하세요.

### 개발·Production 실행

```sh
pnpm dev
```

개발 주소는 <http://localhost:3000>입니다. `/diagnostics`는 공개 API 진단 경로이며 `/dev/ui`는 개발 전용 미리보기입니다. 인증 설정이 없으면 보호 화면을 사용할 수 없습니다. 테스트용 Mock 서버는 아래 Playwright 실행에서 별도로 구성됩니다.

```sh
pnpm build
pnpm start
```

Production 서버도 포트 3000을 사용합니다. Build와 브라우저 테스트는 순차 실행합니다.

## Testing

Playwright Test로 순수 로직부터 브라우저 검증까지 실행합니다. 별도 단위 테스트 프레임워크는 사용하지 않습니다.

| 범위              | 검증 내용                                                           |
| ----------------- | ------------------------------------------------------------------- |
| 순수 로직·계약    | 응답 타입 가드, URL·중복 비교, 폴더 매핑, 정리·차트 Adapter         |
| Mock API 통합     | 로컬 GoTrue 형태 인증 서버, Mock 제품 API, HTTP 계약·오류·계정 격리 |
| 브라우저 상호작용 | 로그인·링크·카테고리·가져오기·프리셋, Sheet·포커스·반응형 동작      |
| 시각 회귀         | `toHaveScreenshot`으로 저장된 PNG 기준 이미지 비교                  |

### 준비와 기본 검사

```sh
pnpm exec playwright install chromium firefox webkit
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
pnpm test --update-snapshots=none
```

`pnpm typecheck`는 `next typegen` 후 `tsc --noEmit`을 실행합니다. `pnpm test`는 기본 `playwright.config.ts`를 사용합니다. `--update-snapshots=none`은 기준 이미지를 생성·갱신하지 않고 비교하도록 명시합니다.

기본 설정은 Chromium·worker 1개이며, 일부 테스트는 Firefox·WebKit·설치된 안정 채널 Google Chrome·Microsoft Edge를 직접 실행합니다. 따라서 전체 기본 검사에도 이 브라우저들이 필요합니다. 브라우저 실행에 필요한 OS 의존성과 실행 권한을 준비하고, 샌드박스가 브라우저 실행을 제한하는 경우 환경 오류를 구분해 확인합니다.

테스트는 로컬 Mock 인증/API 서버 **54329**와 별도 Next 개발 서버 **3100** (`.next/playwright`)을 시작합니다. 두 포트가 비어 있어야 합니다. 테스트 설정이 공개 환경변수를 Mock 주소·테스트 키로 대체하므로 실제 Supabase 계정과 NestJS 서버는 필요하지 않습니다. 이 검사는 실제 Google OAuth·Nest JWT·PostgreSQL 통합 검증을 대신하지 않습니다.

### 추가 브라우저 매트릭스

```sh
pnpm test --config=playwright.bookmark.config.ts --update-snapshots=none
pnpm test --config=playwright.quick-launch.config.ts --update-snapshots=none
```

두 설정은 기본 전체 실행과 별도입니다. 북마크 설정은 선택된 가져오기 테스트를 Firefox·WebKit·Chrome·Edge에서 실행하고 Chromium 전용 CPU throttling 케이스를 제외합니다. 빠른 실행 설정은 `quick-launch-browser.spec.ts`를 각 브라우저의 팝업 정책 조건에서 실행합니다.

### 스냅샷과 검증 기록

기준 이미지는 `tests/*.spec.ts-snapshots/`의 Windows 기준 PNG입니다. OS·글꼴·렌더링 차이를 검토한 뒤에만 의도적으로 갱신합니다. 디자인 시스템 시각 테스트 7개는 브라우저 Date와 Mock 도메인 시각을 고정하고 일반 타이머는 유지합니다. 인증 서버·JWT 시간과 다른 테스트의 시계에는 적용하지 않습니다.

실패 trace 등은 `test-results/`, 추가 스크린샷·측정 결과는 `artifacts/`에 생성됩니다. 테스트 출력과 프로세스 종료 코드를 함께 확인합니다.

**2026-11-03 WO-2 검증 기록:** 기본 Playwright 전체 테스트 **898개 통과, 실패·skip 0**. lint·typecheck·format:check·build도 통과했습니다. 이는 당시 결과이며 현재 실행 결과가 아닙니다. 별도 북마크·빠른 실행 브라우저 매트릭스 전체를 포함한 수치도 아닙니다.

실제 환경의 Google 로그인 → Callback → 새로고침·세션 갱신 → Nest API → 로그아웃은 별도 환경·전용 계정에서 확인해야 합니다. `scripts/verify-bookmark-parity.ts`는 별도 BE 코드 경로가 필요한 선택적 개발 도구이며 일반 FE 검사에 포함되지 않습니다.

## Related Documentation

- [Architecture](docs/ARCHITECTURE.md): 데이터 경계, 인증, Query와 기능별 설계. 최신 변경 절을 우선하며 과거 모노레포·데모 설명은 현재 구조와 구분합니다.
- [Product](docs/PRODUCT.md): 제품 동작과 UI 정책. 같은 항목은 최신 변경 절이 이전 정책을 대체합니다.
- [로컬 API 연결](docs/LOCAL_API.md): 현재 FE·BE 연결 안내. 하단 WO-003 부분은 개발 당시 기록입니다.

실행 명령과 디렉터리 구조는 현재 코드와 이 README를 기준으로 합니다. 과거 WO 보고서의 경로·검증 수치는 작성 당시 기록입니다.
