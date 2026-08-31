# SNS Scraper / SNS Scope

X, YouTube, Instagram 공개 콘텐츠를 플랫폼별 collector로 수집하고 하나의 웹 UI에서 사용하는 프로젝트다.

현재 `main`에는 X와 YouTube의 초기 collector 및 Vite UI scaffold가 들어 있다. Instagram과 실제 frontend-backend 연결은 아직 구현되지 않았다.

## Current status

| 영역 | 상태 | 비고 |
| --- | --- | --- |
| X single post | `PASS` | 공개 HTML HTTP-first + Playwright fallback, 실제 공개 post E2E 검증 이력 있음 |
| X account adapter | `PASS` (deterministic) | twitter-cli discovery + 기존 single-post hydration + known-ID 증분/조기종료 상태 추적 |
| X account live | `SKIP` | `TWITTER_AUTH_TOKEN`, `TWITTER_CT0` 미구성 이력 |
| YouTube single video | `PASS` (deterministic) | yt-dlp adapter와 URL/schema tests |
| YouTube live | `BLOCKED` | 마지막 Codex Cloud 검증에서 YouTube CONNECT 403 |
| Instagram | `NOT IMPLEMENTED` | local/desktop execution model 검토 필요 |
| Vite UI | `PROTOTYPE` | mock 데이터와 mock 연동 상태, collector 미연결 |
| Backend API / DB / persistence | `NOT IMPLEMENTED` | 향후 phase |

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
npm run build

npm run collect:x -- "https://x.com/jack/status/20"
npm run collect:x-account -- "@jack" --limit 3
npm run collect:youtube -- "https://www.youtube.com/watch?v=M7lc1UVf-VE"
```

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
Vite UI (현재 mock)
        │
        ├── X single post
        │     public HTML / metadata
        │     → normalized X JSON
        │     → selective Playwright fallback
        │
        ├── X account
        │     twitter-cli discovery
        │     → optional known-ID filtering / bounded early stop
        │     → collectXPost() hydration
        │
        └── YouTube single video
              yt-dlp metadata
              → normalized YouTube JSON
```

향후 frontend integration 시에도 collector와 UI 사이에는 명시적인 backend/API 경계를 둔다. Vite client가 external CLI를 직접 실행하는 구조로 만들지 않는다.

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
