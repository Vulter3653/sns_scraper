# Project Blueprint: SNS Scraper

Updated: 2026-09-01

이 문서는 프로젝트 목표, architecture, 지원범위, 상태와 보안경계를 기록하는 **canonical source of truth**다. 실행 이력은 `docs/progress.md`, 오류·blocker는 `docs/debug-log.md`, 작업 규칙은 `AGENTS.md`에 분리한다.

## 1. 목적

X, YouTube, Instagram의 공개 콘텐츠를 플랫폼별 collector로 수집하고 공통된 웹 UI에서 조회·분석할 수 있는 구조를 구축한다.

현재 개발 방식은 **기능별 vertical slice**를 우선한다. 하나의 collector 기능을 구현·검증하면 해당 기능을 바로 backend/API와 Vite에 연결해 대응 mock을 실제 기능으로 교체한 뒤 다음 기능으로 이동한다.

## 2. Architecture 원칙

최종 방향:

```text
Vite Web
   ↓
Backend API
   ├── X Collector
   ├── YouTube Collector
   └── Instagram Collector
          ↓
Normalized Schemas
          ↓
Storage / Export
```

현재 repository에는 X single-post vertical slice를 위한 최소 Node HTTP API가 있으며 storage layer는 없다. Vite client는 `/api/x/post`를 통해 collector를 호출하고 external CLI나 credential을 직접 실행/보유하지 않는다.

기능 개발은 vertical slice를 기본으로 한다.

```text
하나의 collector 기능 구현/검증
→ deterministic PASS
→ live E2E PASS
→ 최소 API
→ Vite 실제 연결 및 해당 mock 제거
→ regression/records/merge
→ 다음 기능
```

한 플랫폼의 모든 기능을 먼저 구현한 뒤 frontend 연결을 미루지 않는다.

### 개발 및 통합 순서

기본 순서는 다음과 같다.

```text
MINIMAL PREFLIGHT
→ IMPLEMENT ONE FEATURE
→ TARGETED TEST
→ LIVE VALIDATE IF REQUIRED
→ CONNECT THAT FEATURE TO API/VITE
→ REPLACE CORRESPONDING MOCK
→ RECORD
→ NEXT FEATURE
```

모든 collector를 먼저 완성한 뒤 한 번에 frontend를 연결하지 않는다. 기능 하나가 완료될 때마다 실제 Vite 기능으로 전환한다.

비용 최소화를 위해 사전 전수 검토, 전체 repository audit, 광범위한 외부 reference 비교는 기본 개발 단계가 아니다. 현재 기능의 직접 코드와 dependency만 확인하고 구현을 우선한다. 오류가 발생하면 실패 지점부터 targeted debugging을 수행하고, 해결되지 않을 때만 runtime/network/architecture 검토 범위를 넓힌다.

보안, destructive Git operation, 데이터 손실 가능성이 있는 migration 등 사전 검토 실패 비용이 큰 작업은 필요한 최소 안전 검토를 유지한다.

## 3. 현재 구현 범위

### X single post — collector/API/Vite `PASS`

지원:

```text
https://x.com/<username>/status/<post_id>
https://twitter.com/<username>/status/<post_id>
```

Primary path:

```text
validated URL
→ public HTML HTTP GET
→ structured metadata / Open Graph
→ target status ID validation
→ normalized X JSON
```

Playwright는 제한된 오류에 대한 fallback이다. HTTP 401/403 `HTTP_BLOCKED`에는 불필요한 browser retry를 하지 않는다.

현재 공개 HTML의 Open Graph `article:published_time`을 포함한 machine-readable timestamp를 지원한다. 실제 공개 post CLI, `POST /api/x/post`, Vite browser E2E 검증 이력이 있다. API는 strict JSON body와 기존 X URL validator를 사용하며 stack trace를 client에 반환하지 않는다.

### X account — deterministic `PASS`, live `SKIP`

```text
account input
→ twitter-cli user-posts --json
→ post reference discovery
→ deduplicate
→ optional known-ID filtering / bounded existing-ID stop
→ collectXPost() sequential hydration
```

기본 limit 5, 최대 20, concurrency 1이다. 기존 결과의 numeric post IDs를 `knownPostIds`로 전달하면 동일 ID는 다시 hydration하지 않는다. `stopOnExisting`은 opt-in이며, 명시한 `existingStopThreshold`만큼 연속 known ID를 관측하면 현재 discovery batch 처리를 중단한다. backend가 반환한 순서는 재정렬하지 않는다.

CLI에서는 다음을 지원한다.

```text
--known-ids <newline-id-file>
--stop-on-existing <1-20>
```

증분 옵션을 사용하지 않으면 기존 account collection 동작은 유지된다. Account JSON은 `collection_state`에 known-ID 관측 수, 검사 reference 수, 연속 known-ID 수, 조기 종료 여부와 `stop_reason`을 기록한다. 이 상태는 auditability를 위한 것이며 complete historical coverage를 의미하지 않는다.

live account verification에는 다음 두 credential이 모두 필요하다.

```text
TWITTER_AUTH_TOKEN
TWITTER_CT0
```

credential이 없으면 live E2E를 성공으로 기록하지 않는다.

### YouTube single video — deterministic `PASS`, live `BLOCKED`

지원:

```text
https://www.youtube.com/watch?v=<11-char-id>
https://youtube.com/watch?v=<11-char-id>
https://m.youtube.com/watch?v=<11-char-id>
https://youtu.be/<11-char-id>
```

Backend:

```text
yt-dlp
--dump-single-json
--skip-download
--no-playlist
--js-runtimes node
```

마지막 Codex Cloud live evidence에서는 `www.youtube.com`, `youtube.com`, `youtu.be` HTTPS CONNECT가 Envoy 403으로 차단되어 raw live metadata를 얻지 못했다. 이 상태에서는 fixture mapping을 live validation으로 승격하지 않는다.

### Instagram — `NOT IMPLEMENTED`

Agent Reach 조사에서 OpenCLI + 사용자가 이미 로그인한 desktop Chrome session이 후보로 확인됐다. cloud 환경에서 자동 로그인, cookie DB 추출 또는 anti-bot 우회 방식으로 구현하지 않는다. 먼저 local/desktop execution model을 결정한다.

### UI — X single post `PASS`, 나머지 `PROTOTYPE`

`index.html`, `src/main.js`, `src/style.css`는 SNS Scope mock dashboard다.

X 탭의 단일 public status URL은 실제 backend/API 결과를 렌더링한다. author/text/timestamp/canonical URL과 metrics를 표시하며 missing metric은 `—`로 표현한다. 외부 text는 `textContent`로 렌더링한다.

aggregate metrics와 최근 수집 목록은 명시적으로 demo 상태이며 persistence 근거가 아니다. YouTube UI는 collector-only, Instagram은 미구현으로 표시한다.

완성된 collector 기능은 가능한 다음 vertical slice에서 바로 Vite 실제 기능으로 전환한다. 전체 mock dashboard를 한 번에 교체하지 않는다.

## 4. Normalization 원칙

- 플랫폼 source URL과 canonical URL을 분리한다.
- 플랫폼 고유 ID를 반드시 보존한다.
- machine-readable timestamp를 우선한다.
- 확인되지 않는 값은 `null`/missing으로 남긴다.
- missing을 `0`으로 바꾸지 않는다.
- target ID 또는 author identity가 명백히 충돌하면 fail closed한다.
- raw platform response 전체를 canonical output으로 저장하지 않는다.

## 5. 외부 tool 역할

- `twitter-cli`: X account discovery backend
- `yt-dlp`: YouTube metadata backend
- Playwright/Chrome for Testing: X browser fallback 및 browser smoke validation
- Agent Reach: upstream tool 선택, 설치/doctor 참고. production runtime framework가 아님

외부 CLI 설치는 container/session을 넘어서 보존된다고 가정하지 않는다. 해당 기능 구현/실행 시 필요할 때만 설치 여부와 버전을 확인한다.

## 6. 테스트 계층

### Deterministic

repository fixture 기반 parser/schema/validation test. 네트워크 없이 재현 가능해야 한다.

### Browser smoke

Playwright/Chrome 실행 가능 여부만 검증한다. 특정 플랫폼 live 성공과 동일하지 않다.

### Live E2E

실제 공개 URL에서 collector 전체 흐름이 성공해야 한다. 외부 blocker가 있으면 `BLOCKED` 또는 `SKIP`으로 기록한다.

세 계층의 결과를 서로 대체하지 않는다.

검증은 변경 기능의 targeted test부터 실행한다. 전체 browser/platform regression은 shared code 또는 runtime contract를 변경했거나 오류가 발생했을 때 범위를 확대한다.

## 7. 보안 경계

기본적으로 다음을 금지한다.

- password/credential Git 저장
- browser cookie DB 자동 추출 또는 복사
- CAPTCHA/anti-bot bypass
- stealth/fingerprint spoofing
- proxy rotation/VPN/tunnel을 이용한 접근제어 회피
- TLS validation disable
- private/internal API reverse engineering
- arbitrary URL fetch/SSRF
- 명시적 요구 없는 media binary download

이전 `Vulter3653/x_scrapper`의 browser/GraphQL collector는 증분 상태관리 설계를 참고할 수 있지만, GraphQL response capture, webdriver masking, hard-coded browser fingerprint, cookie injection 같은 접근은 현재 `sns_scraper` 보안 경계 때문에 이식하지 않는다.

## 8. 현재 blockers 및 deferred scope

### Blockers

- X account live: explicit X credentials 필요
- YouTube live: 현재 환경 connectivity는 HTTP 200이지만 external `yt-dlp`가 없어 live extraction은 `SKIP`; 이전 Codex Cloud CONNECT 403은 historical evidence로 보존

### Deferred / not implemented

- X keyword search production 기능
- persistent account checkpoint/storage layer
- YouTube channel/playlist/search/comments/transcript
- Instagram collector
- X single-post 외 backend API
- database/persistence
- scheduler
- X single-post 외 frontend-collector integration

Deferred 항목은 현재 구현된 것으로 표시하지 않는다.

## 9. Vertical roadmap와 승격 조건

- Phase 1: X single post collector → live → API → Vite — `PASS`
- Phase 2: YouTube single video collector → live → API → Vite
- Phase 3: X account live validation → API → Vite
- Phase 4: blocker와 사용자 우선순위에 따라 기능 하나씩 같은 방식으로 승격

각 phase는 deterministic, live CLI, API live, Vite live E2E를 구분한다. live 전제조건이 충족되지 않으면 다음 integration 단계로 승격하지 않는다. Instagram은 local/desktop execution model과 credential boundary를 먼저 확정한다.

현재 우선 원칙:

- 이미 collector가 존재하는 기능은 불필요한 재검토보다 현재 환경에서 필요한 수정/실행을 우선한다.
- collector가 실제 기능으로 완료되면 최소 backend/API를 추가하고 바로 Vite의 해당 mock을 교체한다.
- 오류가 없는 기능에 대해 예방적 전수조사나 전체 architecture 재검토를 반복하지 않는다.
- 오류가 발생하면 해당 failure path만 먼저 디버깅한다.

## 10. 버전과 기록

현재 baseline version은 `0.1.0`이다. `VERSION`과 `package.json` version을 일치시킨다.

의미 있는 상태 변경은 `docs/progress.md`와 `CHANGELOG.md`에 기록하고, 실제 장애의 원인/해결은 `docs/debug-log.md`에 추가한다.
