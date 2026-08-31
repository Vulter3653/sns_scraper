# Project Blueprint: SNS Scraper

Updated: 2026-08-31

이 문서는 프로젝트 목표, architecture, 지원범위, 상태와 보안경계를 기록하는 **canonical source of truth**다. 실행 이력은 `docs/progress.md`, 오류·blocker는 `docs/debug-log.md`, 작업 규칙은 `AGENTS.md`에 분리한다.

## 1. 목적

X, YouTube, Instagram의 공개 콘텐츠를 플랫폼별 collector로 수집하고 공통된 웹 UI에서 조회·분석할 수 있는 구조를 구축한다.

현재 우선순위는 플랫폼별 collector를 독립적으로 검증한 뒤 공통 backend/API와 UI로 통합하는 것이다.

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

현재 repository는 아직 backend API/storage layer가 없으며 CLI collector와 mock Vite UI가 공존한다. Vite client가 external CLI나 credential을 직접 실행/보유하는 구조로 만들지 않는다.

## 3. 현재 구현 범위

### X single post — `PASS`

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

실제 공개 post E2E 검증 이력이 있다.

### X account — deterministic `PASS`, live `SKIP`

```text
account input
→ twitter-cli user-posts --json
→ post reference discovery
→ deduplicate
→ collectXPost() sequential hydration
```

기본 limit 5, 최대 20, concurrency 1이다. live account verification에는 다음 두 credential이 모두 필요하다.

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

### UI — `PROTOTYPE`

`index.html`, `src/main.js`, `src/style.css`는 SNS Scope mock dashboard다.

현재 표시되는 metrics, 최근 수집, 사용자 정보, `정상 연동` 상태는 hard-coded mock이며 실제 collector 결과가 아니다.

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

외부 CLI 설치는 container/session을 넘어서 보존된다고 가정하지 않는다.

## 6. 테스트 계층

### Deterministic

repository fixture 기반 parser/schema/validation test. 네트워크 없이 재현 가능해야 한다.

### Browser smoke

Playwright/Chrome 실행 가능 여부만 검증한다. 특정 플랫폼 live 성공과 동일하지 않다.

### Live E2E

실제 공개 URL에서 collector 전체 흐름이 성공해야 한다. 외부 blocker가 있으면 `BLOCKED` 또는 `SKIP`으로 기록한다.

세 계층의 결과를 서로 대체하지 않는다.

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

## 8. 현재 blockers 및 deferred scope

### Blockers

- X account live: explicit X credentials 필요
- YouTube live: 마지막 Codex Cloud evidence에서 YouTube CONNECT 403

### Deferred / not implemented

- X keyword search production 기능
- YouTube channel/playlist/search/comments/transcript
- Instagram collector
- backend API
- database/persistence
- scheduler
- frontend-collector integration

Deferred 항목은 현재 구현된 것으로 표시하지 않는다.

## 9. 다음 단계 승격 조건

플랫폼 기능을 다음 phase로 확장하기 전에 현재 phase가 해당 환경에서 실제로 검증되어야 한다.

- X account 확장: credentials가 명시적으로 제공된 환경에서 제한된 live discovery + hydration 확인
- YouTube 확장: public single-video live metadata + normalized JSON 확인
- Instagram: local/desktop execution model과 credential boundary 확정
- frontend integration: backend API contract 정의 후 연결

## 10. 버전과 기록

현재 baseline version은 `0.1.0`이다. `VERSION`과 `package.json` version을 일치시킨다.

의미 있는 상태 변경은 `docs/progress.md`와 `CHANGELOG.md`에 기록하고, 실제 장애의 원인/해결은 `docs/debug-log.md`에 추가한다.
