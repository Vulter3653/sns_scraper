# Project Progress

> 첫 섹션은 최신 canonical 실행 상태이고, 아래 날짜별 항목은 당시 기준의 기술 이력이다. 목표/범위의 기준은 [`project-blueprint.md`](project-blueprint.md)다.

## 현재 상태 — VERSION 0.1.0

- **Repository:** 2026-08-31 PR #2의 collector implementation과 `HANDOFF.md`가 `main`에 병합되었다. collector 병합 commit은 `6ec2f689fe5b73c1e482f767cd938d6dc0a12336`이다.
- **Governance:** canonical records는 `project-blueprint → AGENTS → agent-writing-rules → progress → changelog → debug-log` 구조로 유지하지만, 2026-09-01부터 매 task의 전수 검토를 기본 절차로 사용하지 않는다. 현재 task에 직접 필요한 canonical 규칙만 최소 확인하고 구현을 우선한다.
- **Development policy:** 기본 흐름은 `MINIMAL PREFLIGHT → IMPLEMENT → TARGETED TEST → INTEGRATE → RECORD`다. 기능 하나가 완료되면 해당 기능을 바로 backend/API와 Vite에 연결해 대응 mock을 실제 기능으로 교체한다. 오류가 발생하면 그 실패 지점부터 targeted debugging을 수행하고 필요할 때만 검토 범위를 넓힌다.
- **X single post:** HTTP-first collector가 현재 X의 public `article:published_time` metadata를 지원한다. CLI, minimal Node API `POST /api/x/post`, Vite proxy와 실제 browser UI E2E가 `https://x.com/jack/status/20`에서 PASS했다.
- **X account:** `twitter-cli` discovery adapter와 sequential single-post hydration이 구현되고 deterministic tests를 통과한 이력이 있다. `Vulter3653/x_scrapper`의 안전한 증분 패턴을 참고해 known post ID skip, opt-in consecutive-existing early stop, `collection_state.stop_reason` audit가 추가됐다. explicit `TWITTER_AUTH_TOKEN`/`TWITTER_CT0`이 없어 live account E2E는 여전히 `SKIP` 상태다.
- **YouTube:** yt-dlp single-video metadata adapter와 deterministic tests가 구현됐다. 현재 environment의 세 public hostname connectivity는 HTTP 200이지만 yt-dlp가 없어 live extraction은 `SKIP`; 이전 Codex Cloud CONNECT 403은 historical evidence다.
- **Browser:** Playwright 1.62 + project-local Chrome for Testing fallback 구조가 있다. 과거 Codex Cloud의 Playwright CDN 403 및 Chromium proxy-CA trust 문제에 대한 해결 이력이 있다.
- **Instagram:** collector가 없다. local/desktop execution model을 우선 결정해야 한다.
- **UI:** X 탭의 single-post URL flow는 actual API result를 안전한 DOM text로 렌더링한다. aggregate metrics/recent collection은 demo로 명시했고 YouTube/Instagram은 미연결 상태를 표시한다.
- **Backend/storage:** X single-post 전용 built-in Node HTTP API가 있다. database, persistence, scheduler는 없으며 결과는 응답 후 저장하지 않는다.
- **Development order:** 최소 preflight 후 collector → targeted deterministic → live → API → Vite → records의 vertical slice 원칙을 사용한다. 다음 후보는 YouTube single video이며 yt-dlp availability와 live mapping을 먼저 검증한다.

## Technical execution notes

아래 항목은 당시 상태를 보존한다. 최신 판단은 위 현재 상태와 `project-blueprint.md`를 따른다.

## 2026-09-01 — X single-post vertical slice completed

- Fixed: Current X public HTML exposes the machine-readable timestamp as Open Graph `article:published_time`; the HTTP-first parser now consumes that field instead of falling through to a blocked browser navigation. (codex)
- Added: Introduced a dependency-free Node HTTP endpoint `POST /api/x/post` with strict JSON validation, existing X URL validation, sanitized errors, and injected deterministic tests. (codex)
- Added: Connected the Vite X tab to the API with idle/loading/success/error states, safe text rendering, canonical result link, and `—` for unknown metrics. (codex)
- Changed: Marked aggregate dashboard data as demo and replaced misleading channel status copy while preserving YouTube and Instagram as unconnected scope. (codex)
- Validation: Confirmed X live CLI JSON, API live response, and actual Vite browser rendering against `https://x.com/jack/status/20`; deterministic X/account/YouTube/API/UI, browser smoke, build, and governance regressions passed. (codex)
- State: Adopted vertical slices so each collector feature proceeds through live evidence, API, and Vite before the next feature begins. VERSION remains 0.1.0 while the feature is recorded under Unreleased. (codex)

## 2026-09-01 — Development-first, low-review workflow adopted

- Changed: Codex/agent task 기본 흐름을 전수 검토 중심에서 `MINIMAL PREFLIGHT → IMPLEMENT → TARGETED TEST → INTEGRATE → RECORD`로 변경했다. (codex)
- Changed: Repository-wide audit, 외부 reference 재검토, 전체 regression 선실행은 기본 단계에서 제외하고 직접 수정 대상과 dependency만 확인하도록 했다. (codex)
- Changed: 오류가 발생하면 실패한 command/path에서 시작해 direct dependency, runtime/network, broader architecture 순으로 필요한 만큼만 디버깅하도록 했다. (codex)
- Changed: 모든 collector 완성 후 일괄 UI 연결 대신 기능 하나가 완료될 때마다 해당 Vite mock을 실제 기능으로 교체하는 vertical-slice 원칙을 canonical workflow로 기록했다. (codex)
- Preserved: 보안 경계, destructive Git/data-loss 위험에 대한 최소 안전 검토, historical integrity, governance CI는 비용 절감 대상에서 제외하지 않는다. (codex)

## 2026-08-31 — Safe incremental X patterns reused from x_scrapper

- Investigation: Reviewed `Vulter3653/x_scrapper` README, packaged `src/x_scrapper/collection/x_scraper.py`, and ranked account runner. The legacy pipeline uses known tweet IDs, deduplication, explicit stop reasons, incremental run state, bounded retries and per-account audit outputs. (codex)
- Added: Ported only backend-neutral incremental semantics into the current `twitter-cli → collectXPost()` account path: numeric known-ID filtering, opt-in consecutive-known-ID early stop, deterministic `collection_state`, and CLI `--known-ids` / `--stop-on-existing`. (codex)
- Preserved: Existing default account behavior, limit 1-20, sequential hydration, partial failures, X single-post HTTP-first path, and account credential preconditions remain unchanged. (codex)
- Security: Did not port the legacy GraphQL response interception, webdriver masking, hard-coded user-agent/browser fingerprint, or direct browser cookie injection. The current security boundary continues to prohibit private/internal API reverse engineering and anti-bot/stealth behavior. (codex)
- Deferred: Legacy atomic file checkpoints, batch persistence, retry orchestration and queue/audit storage were not copied because `sns_scraper` has no canonical persistence layer yet; those belong to a later backend/storage phase. (codex)

## 2026-08-31 — Automated governance enforcement added

- Docs: Adopted the useful governance subset from `Vulter3653/paper-agent-project`: historical-log preservation, future agent attribution, explicit PR scope/records checklist, and maintainer ownership. Team-specific assignment maps and Firebase/Nix rules were intentionally not copied. (codex)
- Infra: Added `scripts/validate-governance.mjs`, `scripts/validate-history-integrity.mjs`, `.github/workflows/governance.yml`, `.github/pull_request_template.md`, and `.github/CODEOWNERS`. (codex)
- Validation: Governance now requires a changelog update for meaningful PRs, an attributed added changelog record, `docs/progress.md` for policy/runtime-sensitive changes, matching `VERSION`/`package.json`, and preservation of protected history headings/attribution. (codex)
- Preserved: Existing collector implementation, UI, schemas, dependencies, platform status, historical un-attributed records, and current VERSION 0.1.0 remain unchanged. (codex)

## 2026-08-31 — Governance baseline introduced after collector merge

- PR #2의 X/YouTube collector, tests, browser tooling, lockfile과 handoff가 `main`에 병합됐다.
- `AGENTS.md`, `README.md`, `VERSION`, `CHANGELOG.md`, `docs/project-blueprint.md`, `docs/progress.md`, `docs/debug-log.md`를 canonical 기록체계로 도입했다.
- 앞으로 fixture/deterministic/browser/live 상태를 분리하고, blocker를 기능 실패로 오기록하지 않으며, 의미 있는 변경 시 progress/changelog/debug 기록을 함께 관리한다.
- `HANDOFF.md`는 삭제하지 않고 historical handoff로 보존한다.

## 2026-08-31 — Project handoff captured

- `HANDOFF.md`에 구현 범위, runtime tool, 실행 명령, architecture, schema, 보안경계, known blockers와 권장 다음 순서를 기록했다.
- handoff 작성 당시의 local `work` branch/HEAD는 현재 GitHub `main`의 canonical branch 상태를 의미하지 않으므로 새 세션에서는 Git 상태를 다시 확인하도록 명시했다.

## 2026-08-26 — YouTube single-video collector prepared

- `yt-dlp` 기반 metadata-only adapter, strict video URL/ID validation, normalized schema와 deterministic tests를 추가했다.
- 설치된 yt-dlp 2026.08.19와 Node JS runtime option을 확인한 이력이 있다.
- Codex Cloud에서는 YouTube CONNECT 403 때문에 실제 public-video normalized JSON을 만들지 못했으며 해당 제한은 application mapping 문제로 승격하지 않았다.

## 2026-08-26 — X account adapter prepared

- Agent Reach의 upstream-tool 원칙을 참고해 `twitter-cli`를 account discovery backend로 채택했다.
- account input normalization, limit validation, post deduplication, sequential `collectXPost()` hydration과 partial failure schema를 구현했다.
- credentials가 제공되지 않아 live account test는 `SKIP`; deterministic adapter 검증과 live E2E를 구분했다.

## 2026-08-26 — X HTTP-first single-post collection validated

- Chromium browser 접근의 HTTP 403 제약을 우회기법으로 해결하지 않고, 공개적으로 반환되는 X HTML을 Undici로 가져와 schema.org microdata/Open Graph를 파싱하는 HTTP-first 경로를 추가했다.
- `https://x.com/jack/status/20`에서 `post_id=20`, `author.username=jack`, 본문과 machine-readable published time을 실제 추출했다.
- metrics는 public structured metadata에서 명확하지 않아 `null`로 보존했다.
