# Project Progress

> 첫 섹션은 최신 canonical 실행 상태이고, 아래 날짜별 항목은 당시 기준의 기술 이력이다. 목표/범위의 기준은 [`project-blueprint.md`](project-blueprint.md)다.

## 현재 상태 — VERSION 0.1.0

- **Repository:** 2026-08-31 PR #2의 collector implementation과 `HANDOFF.md`가 `main`에 병합되었다. collector 병합 commit은 `6ec2f689fe5b73c1e482f767cd938d6dc0a12336`이다.
- **Governance:** canonical records는 `project-blueprint → AGENTS → agent-writing-rules → progress → changelog → debug-log` 순서로 확인한다. PR to `main`에는 changelog attribution, required progress update, version consistency와 protected-history integrity를 검사하는 자동 governance workflow가 구성되어 있다.
- **X single post:** HTTP-first public metadata collector와 selective Playwright fallback이 구현됐다. `https://x.com/jack/status/20`의 실제 E2E 성공 이력이 있다.
- **X account:** `twitter-cli` discovery adapter와 sequential single-post hydration이 구현되고 deterministic tests를 통과한 이력이 있다. explicit `TWITTER_AUTH_TOKEN`/`TWITTER_CT0`이 없어 live account E2E는 `SKIP` 상태다.
- **YouTube:** yt-dlp single-video metadata adapter와 deterministic tests가 구현됐다. 마지막 Codex Cloud live 검증에서는 `www.youtube.com`, `youtube.com`, `youtu.be` CONNECT가 Envoy 403으로 차단돼 normalized live JSON은 미검증이다.
- **Browser:** Playwright 1.62 + project-local Chrome for Testing fallback 구조가 있다. 과거 Codex Cloud의 Playwright CDN 403 및 Chromium proxy-CA trust 문제에 대한 해결 이력이 있다.
- **Instagram:** collector가 없다. local/desktop execution model을 우선 결정해야 한다.
- **UI:** responsive SNS Scope dashboard scaffold가 있으나 데이터와 channel status는 mock이다. collector와 연결되지 않았다.
- **Backend/storage:** API, database, persistence, scheduler는 아직 없다.
- **다음 우선순위:** 새 실행환경에서 전체 deterministic/browser/build regression을 확인한 뒤, YouTube egress가 가능하면 single-video live mapping을 검증한다. X account는 credentials가 명시적으로 제공될 때만 제한된 live E2E를 실행한다.

## Technical execution notes

아래 항목은 당시 상태를 보존한다. 최신 판단은 위 현재 상태와 `project-blueprint.md`를 따른다.

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
