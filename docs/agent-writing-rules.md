# Agent Writing Rules

Updated: 2026-08-31

이 문서는 Codex, Gemini, Claude 및 향후 agent가 `sns_scraper`의 기록을 동일한 방식으로 유지하기 위한 공통 writing/governance 규칙이다.

## Source of truth

대화 기억이나 과거 chat transcript만으로 작업하지 않는다. 변경 전에 다음을 확인한다.

```text
docs/project-blueprint.md
AGENTS.md
docs/agent-writing-rules.md
docs/progress.md
CHANGELOG.md
docs/debug-log.md  # 관련 장애가 있을 때
```

저장소의 canonical 기록과 대화 기억이 충돌하면 저장소를 우선하며, 실제 최신 실행 증거가 canonical 문서보다 새롭다면 증거를 먼저 검증한 뒤 최소한의 문서만 갱신한다.

## Historical integrity

`CHANGELOG.md`, `docs/progress.md`, `docs/debug-log.md`는 프로젝트의 historical memory다.

- 과거 heading이나 entry를 삭제·요약·정리하지 않는다.
- 새 entry는 reverse-chronological 방식으로 위에 추가한다.
- 오류 정정은 과거 entry를 다시 쓰는 대신 새 correction entry로 남긴다.
- log를 수정한 뒤 line count가 예상치 않게 감소하지 않았는지 확인한다.
- 다른 contributor/agent의 attribution을 삭제하거나 변경하지 않는다.
- 기존 무귀속 과거 기록은 그대로 보존하며 소급 attribution하지 않는다.

자동 검증:

```bash
npm run validate:history
```

이 검증은 protected history의 heading/attribution 삭제, 비정상적 truncation과 empty section을 차단한다.

## Attribution

앞으로 새 의미 있는 dated/version record bullet은 가능한 한 다음 형식을 사용한다.

```text
- Label: Description. (agent-id)
```

허용 label:

```text
Added
Changed
Fixed
Removed
Security
Infra
Docs
Validation
State
```

agent id는 소문자로 기록한다.

```text
(codex)
(gemini)
(claude)
(human)
```

예:

```text
- Validation: Confirmed X single-post live E2E on the canonical jack/status/20 fixture URL. (codex)
```

새 changelog는 attribution을 포함해야 하며 governance validator가 이를 확인한다.

## Required records

모든 의미 있는 PR:

```text
CHANGELOG.md
```

기능, architecture, workflow, repository policy, handoff 또는 current-state 변경:

```text
docs/progress.md
```

실제 defect, blocker, 원인 조사, workflow-confidence 변화:

```text
docs/debug-log.md
```

목표, 지원범위, architecture, 보안경계, phase 상태 변경:

```text
docs/project-blueprint.md
```

공개 version 변경:

```text
VERSION
package.json
```

두 version은 항상 동일해야 한다.

## Scope discipline

- 요청과 무관한 refactor/formatting/dependency upgrade를 같은 PR에 섞지 않는다.
- 한 task branch는 한 논리적 목적을 갖는다.
- 새로운 파일을 만들기 전에 기존 implementation을 검색하고 재사용·확장한다.
- 변경범위가 확대되면 실제 dependency/blocker와 이유를 progress/PR에 남긴다.
- reference/handoff 파일을 정리 명목으로 삭제·rename하지 않는다.

## Evidence language

다음 상태를 섞지 않는다.

```text
PASS
FAIL
BLOCKED
SKIP
NOT LIVE-VALIDATED
```

- fixture/deterministic PASS는 live E2E PASS가 아니다.
- network/credential blocker는 application failure가 아니다.
- missing은 zero가 아니다.
- mock UI 상태는 실제 backend integration 증거가 아니다.
- 검증하지 않은 field/source를 추정해 기록하지 않는다.

## Secrets and sensitive state

secret, token, cookie, browser profile, private key, proxy credential, environment CA/NSS DB를 tracked file, log, fixture, PR body에 기록하지 않는다.

credential 상태는 값이 아니라 `present`/`missing`만 기록한다.

## PR requirements

PR을 열기 전에 최소 다음을 확인한다.

```bash
git status --short
git diff --stat
git diff --name-only
npm run validate:records
```

`.github/pull_request_template.md`에는 다음을 명시한다.

- 목적과 changed scope
- canonical records 갱신 여부
- 실행한 verification
- live/deterministic 구분
- 남은 blocker/uncertainty

## Automatic enforcement

PR to `main`은 `.github/workflows/governance.yml`에서 다음을 검사한다.

```text
scripts/validate-governance.mjs
scripts/validate-history-integrity.mjs
```

검사를 통과시키기 위해 history를 삭제하거나 validator를 약화하거나 required record를 형식적으로 비우지 않는다.

## Final session report

작업 종료 시 다음을 명시한다.

- changed files
- validation command와 결과
- 실행하지 못한 검증과 이유
- commit SHA / branch / PR / resulting main SHA
- remaining blocker 또는 next actionable step
- live evidence와 deterministic evidence의 구분
