# Agent Operating Guide

Updated: 2026-09-01

이 문서는 `sns_scraper`에서 사람과 Codex/agent가 따라야 하는 운영 규칙이다. 프로젝트 상태는 대화 기억보다 저장소 기록을 우선한다.

## 1. 새 작업 시작 순서

새 세션 또는 새 작업의 첫 단계에서는 **필요한 범위만 최소 확인**한다.

기본 preflight는 다음으로 제한한다.

1. `git status --short --branch`
2. 현재 branch, `HEAD`, `origin/main` 확인
3. `docs/project-blueprint.md`, `AGENTS.md`에서 현재 task와 직접 관련된 규칙만 확인
4. task가 닿는 collector/API/UI/test 파일만 확인
5. 외부 CLI가 실제 task에 필요할 때만 `command -v`와 버전을 확인

`docs/progress.md`, `CHANGELOG.md`, `docs/debug-log.md`, `HANDOFF.md`의 전수 검토는 기본 시작 절차가 아니다. 다음 경우에만 필요한 부분을 읽는다.

- 현재 상태 또는 과거 결정이 불명확할 때
- 기존 구현과 충돌할 가능성이 있을 때
- 오류/blocker가 발생했을 때
- 사용자가 명시적으로 audit/review를 요청했을 때

`HANDOFF.md`는 과거 실행상태를 보존하는 인수인계 기록이다. 현재 canonical 상태와 충돌하면 `project-blueprint.md`와 `AGENTS.md`가 우선한다.

### 개발 우선 / 비용 최소화 원칙

기본 작업 모드는 **review-first가 아니라 development-first**다.

```text
MINIMAL PREFLIGHT → IMPLEMENT → TARGETED TEST → INTEGRATE → RECORD
```

- 이미 요구사항과 구현 대상이 명확하면 장시간 repository 전수조사, 유사 저장소 재검토, 전체 dependency 조사부터 시작하지 않는다.
- 구현 전에 필요한 확인은 해당 기능의 입력/출력, 직접 dependency, 수정 대상 파일에 한정한다.
- 정상 경로에서는 설계 검토 보고서나 광범위한 진단 문서를 만들기보다 동작하는 코드를 우선한다.
- 기능 하나가 완성되면 가능한 한 바로 Vite의 대응 mock을 실제 기능으로 교체한다. 모든 collector를 완성한 뒤 한 번에 연결하지 않는다.
- 오류가 발생한 경우에만 실패 지점에서 시작해 원인 범위를 단계적으로 넓힌다.

디버깅 순서는 다음을 기본으로 한다.

```text
FAILED STEP
→ DIRECT INPUT/OUTPUT
→ DIRECT DEPENDENCY
→ RUNTIME/NETWORK/ENVIRONMENT
→ BROADER ARCHITECTURE ONLY IF STILL NEEDED
```

다음은 **기본적으로 하지 않는다**.

- 기능 구현 전 저장소 전체 전수조사
- 이미 확인한 외부 reference repository의 반복 검토
- 관련 없는 전체 regression의 선실행
- 오류가 없는 상태에서의 예방적 대규모 리팩터링
- 명확한 증거 없이 여러 대안 구현을 동시에 비교

단, 보안 경계, 데이터 손실 위험, destructive Git operation, schema migration처럼 사전 확인 실패의 비용이 큰 작업은 필요한 최소 안전 검토를 생략하지 않는다.

## 2. 중단 작업 복구

새 세션에서는 기존 작업을 무조건 재실행하지 않는다. 먼저 다음 중 하나로 분류한다.

- `COMPLETE`: 완료 증거가 있으며 재실행 금지
- `RUNNING`: 기존 프로세스를 중복 시작하지 않음
- `INTERRUPTED_RESUMABLE`: 검증된 checkpoint부터 재개
- `BLOCKED`: blocker를 보존하고 동일 실패를 무한 반복하지 않음
- `INTENTIONALLY_PAUSED`: 명시적 재개 지시 전까지 유지

우선순위는 다음과 같다.

```text
REUSE → TARGETED CHECK → TARGETED UPDATE → FULL RECOMPUTE
```

## 3. Canonical 기록 역할

- `docs/project-blueprint.md`: 목표, architecture, 지원범위, 상태 판정, 보안경계의 source of truth
- `docs/agent-writing-rules.md`: 기록 보존, attribution, scope discipline과 PR 기록 형식
- `docs/progress.md`: 현재 상태와 날짜별 실행 이력
- `CHANGELOG.md`: 버전별 의미 있는 변경
- `docs/debug-log.md`: 실제 오류, 증거, 원인, 해결/잔여 blocker
- `README.md`: 사용자/개발자 진입점
- `VERSION`: 프로젝트 버전. `package.json`의 `version`과 동일해야 함
- `HANDOFF.md`: 과거 handoff 참고자료. canonical 상태 문서가 아님

현재 상태를 바꾸는 문서와 과거 이력을 보존하는 문서를 구분한다. 과거 기록은 최신 상태처럼 덮어쓰거나 정리 명목으로 삭제하지 않는다.

## 4. Historical integrity와 attribution

`CHANGELOG.md`, `docs/progress.md`, `docs/debug-log.md`는 프로젝트의 지속적인 memory layer다.

- 과거 dated/version heading을 삭제하거나 요약·축약하지 않는다.
- 새 이력은 관련 기록의 가장 위에 reverse-chronological 방식으로 추가한다.
- 기존 과거 entry를 새 문장으로 재작성하지 않는다. 실제 오류 정정이 필요하면 새 correction entry를 추가한다.
- 기존 무귀속 기록은 소급해서 attribution을 붙이지 않는다.
- 앞으로 새 의미 있는 기록 bullet은 가능한 한 다음 형식을 사용한다.

```text
- Label: Description. (agent-id)
```

예:

```text
- Docs: Added automated history-integrity validation for canonical logs. (codex)
```

agent id는 소문자로 기록한다. 예: `(codex)`, `(gemini)`, `(claude)`, `(human)`.
다른 contributor/agent의 attribution을 삭제·변경·정규화하지 않는다.

PR 전 다음 자동 검증을 실행한다.

```bash
npm run validate:records
```

`validate:history`는 protected history의 heading/attribution 삭제, 비정상적인 line-count 감소, empty section을 차단한다. 명시적 사용자 지시 없이 validator를 약화하거나 우회하지 않는다.

## 5. 상태 표기 규칙

다음 용어를 엄격히 구분한다.

- `PASS`: 해당 검증을 실제로 실행해 성공
- `FAIL`: 실행했고 기능/검증 자체가 실패
- `BLOCKED`: 외부 네트워크, 자격증명, 플랫폼 정책 등으로 검증 단계에 진입하지 못함
- `SKIP`: 전제조건이 없어 의도적으로 실행하지 않음
- `NOT LIVE-VALIDATED`: deterministic fixture는 통과했지만 실제 플랫폼 E2E가 확인되지 않음

**Fixture PASS를 live PASS라고 기록하지 않는다.**

Mock UI의 숫자, 최근 수집 목록, `정상 연동` 문구는 실제 backend 상태 증거가 아니다. frontend와 collector가 연결되기 전까지 mock/prototype로 기록한다.

## 6. Reuse-before-create

새 collector, parser, runner, adapter, test helper가 필요할 때는 **현재 repository의 직접 관련 구현을 먼저 재사용**한다.

```text
DIRECT REUSE → EXTEND → CREATE NEW
```

광범위한 외부 검색/유사 저장소 비교는 기본 절차가 아니다. 현재 구현으로 진행하다가 실제 기능 gap이나 오류가 발견됐을 때만 필요한 reference를 조사한다.

- X account hydration은 기존 `collectXPost()`를 재사용한다.
- X public HTML transport/parser와 browser fallback을 중복 구현하지 않는다.
- YouTube metadata는 기존 yt-dlp adapter를 재사용한다.
- Agent Reach는 runtime framework가 아니라 upstream tool 선택/진단 참고자료다.

## 7. Scope discipline

작업 시작 시 현재 요청을 만족하는 최소 변경범위를 정하고 바로 구현한다.

- unrelated refactor, formatting sweep, dependency upgrade는 같은 PR에 섞지 않는다.
- 기능 하나가 완성되면 그 기능에 필요한 API/Vite 연결까지 같은 vertical slice에서 수행하는 것을 우선한다.
- 변경범위를 확대해야 하면 실제 dependency 또는 blocker를 근거로 한다.
- 한 task branch는 하나의 논리적 기능 또는 정책 변경을 목표로 한다.
- 광범위한 diff review는 기본 단계가 아니며, merge 전 changed-file 범위와 필수 기록 정도만 확인한다.
- 생성 파일보다 기존 canonical implementation의 확장을 우선한다.

## 8. 플랫폼별 현재 원칙

### X single post

Primary는 공개 HTML HTTP 수집이고 Playwright는 제한된 fallback이다. target status ID를 검증하며 첫 article을 무조건 선택하지 않는다. 확인할 수 없는 metric은 `0`이 아니라 `null`이다.

### X account

`twitter-cli user-posts`는 discovery backend이고 게시물 상세은 기존 X single-post collector로 hydration한다. 기본 limit 5, 최대 20, concurrency 1을 유지한다. live account 검증에는 `TWITTER_AUTH_TOKEN`과 `TWITTER_CT0`이 모두 필요하다.

### YouTube

`yt-dlp --dump-single-json --skip-download --no-playlist --js-runtimes node` 기반 metadata-only 수집을 유지한다. cookie/login/media download를 기본 해결책으로 추가하지 않는다. live evidence 없이 normalizer mapping을 바꾸지 않는다.

### Instagram

현재 구현되지 않았다. Agent Reach 조사상 OpenCLI + 사용자가 이미 로그인한 desktop Chrome session 방식이 후보이며, cloud 환경에서 자동 로그인/cookie 추출로 우회하지 않는다.

## 9. 외부 요청과 blocker

- 동일 endpoint의 알려진 403/429/CONNECT 차단을 한 세션에서 반복하지 않는다.
- 정상 경로에서 사전 네트워크 진단을 과도하게 수행하지 않는다. 실제 요청이 실패하면 해당 오류부터 진단한다.
- blocker가 application code 이전 계층이면 증거 없이 collector를 수정하지 않는다.
- 새로운 hostname/permission 요구는 실제 로그 증거가 있을 때만 추가한다.
- 외부 tool 버전은 해당 tool이 현재 task에서 실제로 필요할 때 확인한다.
- 장시간 작업은 필요할 때만 bounded retry/checkpoint를 사용한다.

## 10. 보안 및 자격증명

절대 저장하거나 출력하지 않는다.

- password
- session cookie
- `TWITTER_AUTH_TOKEN`
- `TWITTER_CT0`
- browser cookie DB
- private key
- proxy credential
- 환경별 CA/NSS database

credential preflight는 필요한 기능을 실행할 때 `present`/`missing`만 기록한다. secret은 command argument보다 환경변수/secret store를 사용한다.

다음 우회는 기본적으로 금지한다.

- CAPTCHA/anti-bot bypass
- stealth/fingerprint spoofing
- proxy rotation/VPN/tunnel을 이용한 접근제어 회피
- certificate validation 비활성화
- X private GraphQL/API reverse engineering
- 자동 로그인 또는 browser cookie 자동 추출

## 11. 데이터/출력 원칙

- 확인되지 않은 값은 추정하지 않는다.
- missing과 zero를 구분한다.
- partial failure를 success로 숨기지 않는다.
- raw platform HTML/JSON 전체를 fixture나 Git 기록으로 저장하지 않는다.
- test fixture는 최소 재현 자료이며 live snapshot으로 취급하지 않는다.
- media binary는 명시적 요구가 없는 한 다운로드하지 않는다.

## 12. 변경 및 검증 범위

비용과 실행시간을 줄이기 위해 **검증도 단계적으로 수행**한다.

### 기본 성공 경로

구현 직후에는 변경 기능에 직접 대응하는 최소 deterministic test와 build/type/syntax check만 실행한다.

예:

```text
X single-post 변경 → test:x + 관련 API/UI test
X account 변경 → test:x-account
YouTube 변경 → test:youtube
Vite 변경 → 관련 UI test + build
```

전체 browser install/smoke, 모든 플랫폼 test, live probe, 환경 진단을 매 작업 시작/중간에 반복하지 않는다.

### 오류 발생 시

해당 실패를 재현하는 가장 작은 test/command부터 디버깅한다. 원인이 해결되지 않을 때만 주변 regression, runtime, network, external-tool 검토로 확대한다.

### merge 전

의미 있는 기능 변경은 다음 최소 공통 검증을 수행한다.

```bash
git diff --check
npm run validate:records
npm run build
```

그리고 변경 기능의 직접 test를 반드시 포함한다. 전체 플랫폼 regression은 공통 코드, shared dependency, build/runtime contract를 건드렸거나 실제 오류 징후가 있을 때 수행한다.

live validation은 기능의 완료 판정에 실제로 필요할 때 수행하되, 이미 같은 환경/코드에서 확보된 유효한 evidence를 이유 없이 반복하지 않는다. 외부 blocker 때문에 못 하면 `BLOCKED`/`SKIP`으로 기록한다.

## 13. Git 및 PR 정책

- 직접 `main`에 기능·정책 변경을 push하지 않는다.
- 작업 branch를 사용하고 shared history를 force-push/rebase로 재작성하지 않는다.
- unrelated branch/PR을 임의 수정하지 않는다.
- 성공적인 일반 변경의 기본 완료 흐름은 다음이다.

```text
IMPLEMENT → TARGETED VALIDATE → COMMIT → PUSH → PR → MERGE → VERIFY MAIN
```

PR은 `.github/pull_request_template.md`의 scope, records, verification, live-validation 항목을 실제 수행 범위에 맞게 채운다.
`Governance rules` check가 실패하면 해당 실패를 디버깅하고, required check/review가 있으면 우회하지 않는다.
`CODEOWNERS`는 maintainer ownership을 명시하며 branch protection이 활성화된 경우 해당 review 조건을 존중한다.

merge conflict가 있으면 기존 양쪽 history와 파일을 필요한 범위에서만 비교하고, 데이터/기능 손실 없는 최소 해소만 한다.

## 14. 기록 갱신 규칙

모든 의미 있는 PR은 반드시 `CHANGELOG.md`를 갱신한다.

기능/architecture/상태/handoff/workflow/repository policy 변경은 추가로:

- `docs/progress.md`

를 갱신한다.

실제 오류, 환경 blocker, 원인과 해결 또는 검증 신뢰도 변화는:

- `docs/debug-log.md`

에 기록한다.

프로젝트 목표, 지원범위, canonical architecture, 보안경계 또는 phase 상태가 바뀌면:

- `docs/project-blueprint.md`

도 갱신한다.

공개 실행계약/버전이 바뀌면 `VERSION`과 `package.json` version을 함께 갱신한다.

## 15. 자동 governance enforcement

PR to `main`에서는 다음을 자동 검증한다.

- 의미 있는 PR의 `CHANGELOG.md` 변경
- 새 changelog attribution line 존재
- policy/runtime-sensitive 변경 시 `docs/progress.md` 변경
- `VERSION`과 `package.json` version 일치
- protected history heading/attribution 보존
- protected history의 비정상적 truncation과 empty section 방지

구현 파일:

```text
.github/workflows/governance.yml
scripts/validate-governance.mjs
scripts/validate-history-integrity.mjs
```

validator를 통과시키기 위해 실제 기록을 삭제하거나 검사를 무력화하지 않는다.

## 16. 작업 종료 보고

최종 보고는 길게 재검토하지 않고 실행 결과 중심으로 작성한다.

최소 포함:

- PASS / PARTIAL PASS / BLOCKED
- 구현/변경 파일
- 직접 실행한 targeted test
- 오류가 있었다면 원인과 수정
- commit/branch/PR/main SHA
- 남은 blocker와 다음 구현 step

실행하지 않은 광범위한 검토 항목을 형식적으로 채우기 위해 추가 작업하지 않는다.
