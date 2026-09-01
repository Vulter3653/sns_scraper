# Agent Writing Rules

Updated: 2026-09-01

이 문서는 Codex, Gemini, Claude 및 향후 agent가 `sns_scraper`의 기록을 동일한 방식으로 유지하기 위한 공통 writing/governance 규칙이다.

## Source of truth

대화 기억이나 과거 chat transcript만으로 작업하지 않는다. 다만 비용 최소화를 위해 **모든 기록을 매 task마다 전수 검토하지 않는다.**

기본적으로 다음 두 문서에서 현재 task와 직접 관련된 부분만 확인한다.

```text
docs/project-blueprint.md
AGENTS.md
```

추가 문서는 필요할 때만 읽는다.

```text
docs/agent-writing-rules.md  # 기록을 실제로 수정할 때
docs/progress.md             # 현재 상태/과거 결정이 필요할 때
CHANGELOG.md                  # 기록 추가 위치 확인이 필요할 때
docs/debug-log.md             # 오류/blocker가 발생했을 때
HANDOFF.md                    # historical context가 실제로 필요한 경우
```

저장소의 canonical 기록과 대화 기억이 충돌하면 저장소를 우선하며, 실제 최신 실행 증거가 canonical 문서보다 새롭다면 해당 evidence를 사용해 필요한 기록만 최소 갱신한다.

## Development-first documentation rule

문서 검토가 개발을 선행하는 독립 작업이 되지 않도록 한다.

```text
MINIMAL CONTEXT → IMPLEMENT → TARGETED TEST → RECORD
```

- 요구사항과 수정 대상이 명확하면 전수 review 없이 구현을 시작한다.
- 오류가 발생하면 관련 `debug-log`, 과거 결정, 외부 reference를 그때 필요한 범위만 조사한다.
- 오류가 없는 상태에서 과거 기록을 재검증하거나 기존 reference repository를 반복 조사하지 않는다.
- 기능 구현과 무관한 문서 정리는 같은 task에 추가하지 않는다.
- 기록은 실제 구현/검증 결과를 반영하기 위한 것이며 기록 작성을 위해 추가 검토 작업을 만들지 않는다.

## Historical integrity

`CHANGELOG.md`, `docs/progress.md`, `docs/debug-log.md`는 프로젝트의 historical memory다.

- 과거 heading이나 entry를 삭제·요약·정리하지 않는다.
- 새 entry는 reverse-chronological 방식으로 위에 추가한다.
- 오류 정정은 과거 entry를 다시 쓰는 대신 새 correction entry로 남긴다.
- 다른 contributor/agent의 attribution을 삭제하거나 변경하지 않는다.
- 기존 무귀속 과거 기록은 그대로 보존하며 소급 attribution하지 않는다.

자동 검증:

```bash
npm run validate:history
```

이 검증은 protected history의 heading/attribution 삭제, 비정상적 truncation과 empty section을 차단한다. 별도의 수동 history audit는 validator 실패 또는 실제 이상 징후가 있을 때만 수행한다.

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

필수 기록 외의 문서는 사용자가 요청하거나 실제 interface/contract가 바뀔 때만 갱신한다.

## Scope discipline

- 요청과 무관한 refactor/formatting/dependency upgrade를 같은 PR에 섞지 않는다.
- 한 task branch는 한 논리적 목적을 갖는다.
- 새로운 파일을 만들기 전에 현재 repository의 직접 관련 implementation을 우선 재사용·확장한다.
- 외부 repository/reference 검색은 실제 기능 gap 또는 오류가 있을 때만 수행한다.
- 변경범위가 확대되면 실제 dependency/blocker가 있는 경우에만 이유를 progress/PR에 남긴다.
