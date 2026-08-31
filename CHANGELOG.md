# Changelog

> 각 항목은 당시 상태를 보존하는 역사 기록이다. 최신 canonical 상태는 `README.md`, `docs/project-blueprint.md`, `docs/progress.md`를 따른다.

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
