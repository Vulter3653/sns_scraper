# Changelog

> 각 항목은 당시 상태를 보존하는 역사 기록이다. 최신 canonical 상태는 `README.md`, `docs/project-blueprint.md`, `docs/progress.md`를 따른다.

## Unreleased - 2026-09-01

- Changed: Adopted a development-first, low-review execution policy: minimal task preflight, immediate implementation, targeted tests, then integration/records. (codex)
- Changed: Repository-wide audits, repeated external-reference review and full regression before implementation are no longer default steps; they are expanded only when an error, blocker or shared-runtime risk provides evidence. (codex)
- Changed: Debugging now starts from the failed command/path and expands only as needed through direct dependencies, runtime/network and broader architecture. (codex)
- Changed: Completed features should be connected to the backend/API and Vite immediately so corresponding mocks are replaced incrementally instead of waiting for all collectors to finish. (codex)
- Preserved: Security boundaries, destructive-operation safeguards, historical integrity and governance validation remain mandatory. (codex)
- Fixed: Added support for X public Open Graph `article:published_time`, restoring HTTP-first live extraction without browser or private API workarounds. (codex)
- Added: Added a dependency-free `POST /api/x/post` backend contract with strict request validation, sanitized error mapping, and deterministic API coverage. (codex)
- Added: Connected the Vite X tab to actual single-post collection with loading, error, safe result rendering, canonical links, and unknown metrics displayed as `—`. (codex)
- Changed: Applied the vertical-slice policy by clearly marking remaining dashboard aggregates and platform surfaces as demo/unconnected. (codex)
- Validation: Passed live X CLI, live API, and live Vite browser E2E for `https://x.com/jack/status/20` while preserving X account and YouTube deterministic regressions. (codex)

## Unreleased - 2026-08-31

- Added: Reused the safe incremental-collection pattern from `Vulter3653/x_scrapper` by allowing X account collection to accept known post IDs, skip duplicate hydration, and optionally stop after a bounded number of consecutive known IDs. (codex)
- Changed: X account results now expose an additive `collection_state` audit object with examined references, known posts seen, consecutive known IDs, early-stop status, and explicit `stop_reason`; default collection behavior remains unchanged when incremental options are omitted. (codex)
- Added: `collect:x-account` now accepts `--known-ids <newline-id-file>` and opt-in `--stop-on-existing <1-20>` for bounded incremental account runs. (codex)
- Security: Reviewed the legacy `x_scrapper` Playwright/GraphQL collector but intentionally did not copy GraphQL response capture, webdriver masking, hard-coded browser fingerprinting, or browser cookie injection because they conflict with the current `sns_scraper` security boundary. (codex)
- Docs: Added `docs/agent-writing-rules.md` to formalize historical integrity, attribution, scope discipline, evidence language, and required record updates across agents. (codex)
- Infra: Added PR governance and history-integrity validators plus a `Governance rules` workflow that checks changelog attribution, required progress updates, version consistency, and protected-history preservation. (codex)
- Docs: Added a PR template and CODEOWNERS policy for maintainer-reviewed, scope-explicit integration into `main`. (codex)
- Changed: Added `validate:governance`, `validate:history`, and `validate:records` npm scripts without changing collector dependencies or runtime behavior. (codex)
- Preserved: Existing un-attributed historical records remain unchanged and are not retroactively rewritten. (codex)

## 0.1.0 - 2026-08-31

- Added: X public single-post collector with URL validation, proxy-aware public HTML retrieval, JSON-LD/schema.org/Open Graph parsing, normalized output and selective Playwright fallback.
- Added: X account discovery adapter using `twitter-cli user-posts`, deduplication, bounded limit and sequential hydration through the existing single-post collector.
- Added: YouTube single-video metadata collector using external `yt-dlp`, strict URL/video-ID validation, normalized metadata mapping and shell-free child-process execution.
- Added: Browser helper, reproducible Chrome for Testing installer, npm lockfile and deterministic browser/X/X-account/YouTube test suites.
- Added: Repository governance baseline with `AGENTS.md`, `README.md`, `VERSION`, `docs/project-blueprint.md`, `docs/progress.md` and `docs/debug-log.md`.
- Merged: PR #2 into `main`, preserving the collector implementation and historical `HANDOFF.md`.
- Validated historically: X public post `https://x.com/jack/status/20` returned `post_id=20`, `author.username=jack`, `text="just setting up my twttr"`, `published_at=2006-03-21T20:50:14.000Z` through the HTTP-first collector.
- Preserved: X account live E2E remains unverified without explicit `TWITTER_AUTH_TOKEN` and `TWITTER_CT0`; deterministic adapter tests are not recorded as live success.
- Preserved: YouTube live E2E remains blocked in the last Codex Cloud evidence because Envoy rejected CONNECT to `www.youtube.com`, `youtube.com` and `youtu.be`; fixture tests are not recorded as live success.
- Preserved: Vite UI remains a mock/prototype and is not connected to the collectors; Instagram, backend API, database and persistence remain unimplemented.
