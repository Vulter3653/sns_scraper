# SNS Scraper / SNS Scope

X, YouTube, Instagram 공개 콘텐츠를 플랫폼별 collector로 수집하고 하나의 웹 UI에서 사용하는 프로젝트다.

현재 X single-post는 collector, minimal backend API, Vite UI까지 실제 연결됐다. X account와 YouTube는 collector-only이며 Instagram은 구현되지 않았다.

## Current status

| 영역 | 상태 | 비고 |
| --- | --- | --- |
| X single post | `PASS` | 공개 HTML HTTP-first → `POST /api/x/post` → Vite 실제 결과, live UI E2E 검증 |
| X account adapter | `PASS` (deterministic) | twitter-cli discovery + 기존 single-post hydration + known-ID 증분/조기종료 상태 추적 |
| X account live | `SKIP` | `TWITTER_AUTH_TOKEN`, `TWITTER_CT0` 미구성 이력 |
| YouTube single video | `PASS` (deterministic) | yt-dlp adapter와 URL/schema tests |
| YouTube live | `SKIP` | 현재 hostname connectivity는 HTTP 200이나 yt-dlp 미설치 환경에서 미실행 |
| Instagram | `NOT IMPLEMENTED` | local/desktop execution model 검토 필요 |
| Vite UI | `PARTIAL PASS` | X single-post는 실제 연결; aggregate/recent는 demo, 타 플랫폼 미연결 |
| Backend API | `PARTIAL PASS` | X single-post endpoint만 구현 |
| DB / persistence | `NOT IMPLEMENTED` | 응답 결과를 저장하지 않음 |

현재 상태의 세부 기준은 [`docs/project-blueprint.md`](docs/project-blueprint.md)와 [`docs/progress.md`](docs/progress.md)를 따른다.

## Setup

```bash
npm ci
npm run install:browser
```

외부 CLI는 npm dependency가 아니다. 관련 작업 전에 PATH와 버전을 확인한다.

- X account discovery: `twitter-cli`
- YouTube metadata: `yt-dlp`
- Agent Reach: upstream tool 조사/doctor 참고용, production runtime dependency 아님

## Commands

```bash
npm run test:browser
npm run test:x
npm run test:x-account
npm run test:youtube
npm run test:api
npm run test:ui
npm run build

npm run collect:x -- "https://x.com/jack/status/20"
npm run collect:x-account -- "@jack" --limit 3
npm run collect:youtube -- "https://www.youtube.com/watch?v=M7lc1UVf-VE"
```

X single-post를 Vite에서 사용하려면 두 terminal에서 API와 Vite를 실행한다.

```bash
npm run dev:api
npm run dev
```

브라우저에서 Vite URL을 열고 X 탭을 선택한 뒤 public status URL을 입력한다. 개발 server는 `/api`를 `127.0.0.1:8787`로 proxy한다. X keyword, 전체 탭, YouTube와 Instagram submit은 아직 실제 수집 기능이 아니다.

X account live 명령은 자격증명 전제조건이 충족된 환경에서만 사용한다.

이전 수집 결과의 post ID를 한 줄에 하나씩 저장한 파일이 있으면 account discovery batch에서 이미 알려진 post를 다시 hydration하지 않을 수 있다.

```bash
npm run collect:x-account -- "@jack" --limit 20 --known-ids ./known-x-post-ids.txt
```

`twitter-cli user-posts`의 반환 순서를 그대로 사용하는 명시적 증분 모드에서는 연속 기존 ID를 만났을 때 조기 종료할 수도 있다.

```bash
npm run collect:x-account -- "@jack" --limit 20 \
  --known-ids ./known-x-post-ids.txt \
  --stop-on-existing 3
```

`--stop-on-existing`은 opt-in이며 `--known-ids`와 함께만 사용한다. 기본 account collection 동작은 기존과 동일하다. 결과 JSON의 `collection_state`에 `known_posts_seen`, `stopped_on_existing`, `stop_reason`이 기록된다.

## Architecture

```text
Vite X tab
  → POST /api/x/post
  → Node HTTP API
  → collectXPost()
  → public HTML metadata
  → normalized X JSON
  → safe DOM rendering

Collector only, not yet connected:
  X account → twitter-cli discovery → collectXPost() hydration
  YouTube single video → yt-dlp metadata
```

개발은 collector → deterministic → live → API → Vite의 vertical slice로 진행한다. Vite client가 external CLI, Node collector 또는 credential을 직접 실행/보유하지 않는다.

## Repository records

작업자는 다음 순서로 기록을 읽는다.

1. [`docs/project-blueprint.md`](docs/project-blueprint.md) — canonical 목표/범위/상태
2. [`AGENTS.md`](AGENTS.md) — 작업 규칙
3. [`docs/agent-writing-rules.md`](docs/agent-writing-rules.md) — 기록 보존/attribution/PR 규칙
4. [`docs/progress.md`](docs/progress.md) — 현재 상태와 실행 이력
5. [`CHANGELOG.md`](CHANGELOG.md) — 버전 변경
6. [`docs/debug-log.md`](docs/debug-log.md) — 오류와 blocker

[`HANDOFF.md`](HANDOFF.md)는 2026-08-31 이전 개발을 정리한 역사적 인수인계 자료로 보존한다. 현재 상태와 충돌할 경우 위 canonical 문서가 우선한다.

## Security boundary

프로젝트 기본 방침은 public-content collection이다. 다음을 정상 해결책으로 추가하지 않는다.

- 자동 로그인 및 password 저장
- browser cookie DB 자동 읽기/복사
- CAPTCHA/anti-bot bypass
- stealth/fingerprint spoofing
- proxy rotation/VPN/tunnel을 이용한 접근제어 회피
- TLS certificate validation 비활성화
- X private API/GraphQL reverse engineering
- secret/token/cookie를 fixture, log 또는 Git에 기록

확인하지 못한 metric이나 metadata는 `0`으로 만들지 않고 `null`/missing으로 유지한다.

## Version

현재 governed baseline: `0.1.0`.

`VERSION`과 `package.json` version은 동일하게 유지한다.
