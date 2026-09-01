# Debug Log

> 아래 항목은 발생 당시의 기술 기록이다. 과거 오류를 삭제하지 않으며 최신 상태는 [`project-blueprint.md`](project-blueprint.md)와 [`progress.md`](progress.md)를 따른다.

## 2026-09-01 — X HTTP-first live regression caused by public metadata field change

- **Symptom:** curl and Node received HTTP 200 for `https://x.com/jack/status/20`, but `collect:x` returned `NAVIGATION_FAILED` after parser fallback.
- **Evidence:** Current public HTML contained canonical/OG target URL, author, description text, and `article:published_time=2006-03-21T20:50:14.000Z`, but no JSON-LD `SocialMediaPosting`, schema.org microdata, or `datePublished`. The parser therefore raised `EXTRACTION_FAILED`; Playwright fallback then failed navigation with `net::ERR_HTTP_RESPONSE_CODE_FAILURE`.
- **Root cause:** The HTTP-first parser did not recognize the public Open Graph article timestamp even though the required machine-readable value was present.
- **Resolution:** Added `article:published_time` as the final timestamp source after JSON-LD and microdata. No selectors, GraphQL, cookies, stealth, proxy rotation, or TLS bypass were added.
- **Validation:** Deterministic OG-only regression, live CLI stdout assertions, actual API response, and Vite browser E2E all returned `post_id=20`, `author.username=jack`, the expected text, and the expected timestamp. (codex)

## 2026-08-31 — Legacy x_scrapper workflow reviewed for safe code reuse

- **Investigation:** `Vulter3653/x_scrapper`의 `src/x_scrapper/collection/x_scraper.py`와 ranked collection runner를 검토했다. 기존 구현은 tweet ID deduplication, known-ID stop, explicit `stop_reason`, incremental state/audit, bounded retries를 사용하지만 동시에 authenticated browser cookie injection, GraphQL response interception, webdriver masking과 hard-coded user-agent를 사용한다.
- **Reusable finding:** known IDs를 별도 set으로 유지하고, 이미 수집된 ID는 다시 처리하지 않으며, 연속 기존 ID threshold를 만나면 긴 timeline 작업을 조기 종료하는 패턴은 backend와 무관하고 현재 account adapter에도 유효하다.
- **Applied:** 현재 `twitter-cli → collectXPost()` 경로에 numeric `knownPostIds`, opt-in `stopOnExisting`, bounded `existingStopThreshold`, additive `collection_state.stop_reason`을 도입했다. CLI는 newline ID file을 읽는 `--known-ids`와 명시적 `--stop-on-existing`을 지원한다.
- **Not applied:** GraphQL endpoint/response capture, webdriver masking, hard-coded browser fingerprint/user-agent, browser cookie injection은 현재 `sns_scraper`의 anti-bot/private-internal API 보안 경계와 충돌하므로 복사하지 않았다.
- **Deferred:** `x_scrapper`의 atomic file checkpoint, per-account disk audit, retry orchestration과 batch runner는 storage/backend execution model이 정해진 뒤 재검토한다. 현재 stateless CLI에 임의 persistence 구조를 추가하지 않았다.
- **Validation boundary:** 이번 변경은 deterministic account behavior를 강화하는 것으로, X account live E2E 상태를 `SKIP`에서 `PASS`로 승격하지 않는다. live 검증에는 여전히 explicit X credentials가 필요하다.

## 2026-08-31 — PR #2 branch divergence blocked direct mergeability

- **Symptom:** PR #2의 head branch와 `main`이 공통 초기 commit 이후 각각 분기되어 GitHub가 `mergeable: false`로 표시했다. compare 기준 최신 branch는 collector 4개 핵심 commit을 보유했지만 기존 `main`의 UI merge history와 diverged 상태였다.
- **Evidence:** `main`의 UI blob은 최신 branch에도 동일하게 존재했고, 최신 branch가 collector/tests/lockfile/handoff를 추가한 형태였다. `main`에만 존재하고 최신 tree에서 손실되는 파일은 없었다.
- **Resolution:** 최신 branch tree `25f98a3de4e2e140ee51c387eef9b4237edd658d`를 그대로 보존한 merge commit `8aac4ba7fc859d79a72d16c853210bd8cd26039f`에 최신 branch와 `main`을 두 parent로 기록했다. 이후 compare는 `ahead_by=5`, `behind_by=0`이 되었고 PR #2를 merge commit 방식으로 병합했다.
- **Result:** `main` collector merge SHA는 `6ec2f689fe5b73c1e482f767cd938d6dc0a12336`. collector/UI 내용을 임의로 덮어쓰거나 shared history를 force-rewrite하지 않았다.

## 2026-08-26 — YouTube live extraction blocked at Codex Cloud CONNECT

- **Symptom:** `www.youtube.com`, `youtube.com`, `youtu.be`에 대한 curl 및 yt-dlp 요청이 HTTPS/TLS 전에 Envoy `403 Forbidden`으로 종료됐다.
- **Cause classification:** application parser/yt-dlp mapping 이전의 Codex Cloud egress policy blocker.
- **Handling:** cookie, login, proxy rotation, VPN/tunnel 또는 certificate-validation disable을 사용하지 않았다. live raw metadata가 없으므로 deterministic fixture mapping을 live success로 기록하지 않고 `BLOCKED`로 보존했다.
- **Resolution:** unresolved in that environment. 새로운 환경에서는 먼저 connectivity를 확인하고, CONNECT가 계속 차단되면 application code를 수정하지 않는다.

## 2026-08-26 — X Chromium TLS trust fixed, then browser-specific HTTP 403 exposed

- **Symptom:** Chrome for Testing이 GitHub/X에서 `ERR_CERT_AUTHORITY_INVALID`를 반환했지만 curl/OpenSSL은 Codex egress proxy certificate를 검증했다.
- **Cause:** Codex Cloud egress proxy가 certificate를 재발급했으며 system clients는 환경 제공 CA를 신뢰했지만 Chrome user NSS DB에는 동일 CA가 없었다.
- **Resolution:** 환경이 명시적으로 제공한 public proxy CA의 subject/issuer/fingerprint를 확인한 뒤 user NSS DB에 CA만 정상 trust로 import했다. certificate validation은 비활성화하지 않았다. 이 환경별 CA/NSS DB는 repository에 저장하지 않았다.
- **Result:** GitHub Chromium navigation은 정상화됐고 X는 TLS 이후 HTTP 403까지 진행했다. X browser 403은 별도 접근제약으로 분리했다.

## 2026-08-26 — X browser 403 led to HTTP-first public metadata path

- **Symptom:** certificate trust 해결 후에도 Chromium은 X navigation에 HTTP 403을 받았지만 curl/Undici proxy-aware request는 공개 X post HTML에 HTTP 200을 받았다.
- **Resolution:** user-agent spoofing, stealth, cookie/session 또는 private GraphQL을 추가하지 않고 공개 HTML의 schema.org/Open Graph metadata를 primary extraction source로 사용하도록 collector를 전환했다. 기존 Playwright path는 selective fallback으로 보존했다.
- **Result:** `https://x.com/jack/status/20` 실제 normalized JSON 추출 성공.

## 2026-08-26 — Standard Playwright Chromium CDN unavailable

- **Symptom:** `npx playwright install chromium`이 Playwright CDN/AzureEdge에서 `403 Domain forbidden`으로 실패했다.
- **Resolution:** 설치된 Playwright metadata에서 요구 Chrome for Testing version/revision을 동적으로 읽고 공식 Google Chrome for Testing storage에서 project-local `.cache/`에 설치하는 `scripts/install-browser.sh`를 추가했다.
- **Safety:** browser version을 hard-code하지 않고 `.cache/`를 Git에서 제외했으며 insecure mirror나 certificate bypass를 사용하지 않았다.
