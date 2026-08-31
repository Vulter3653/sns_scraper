# SNS Scraper 개발 인수인계

> 최종 갱신: 2026-08-31 (UTC)  
> 작업 저장소: `/workspace/sns_scraper`  
> 작업 브랜치: `work`  
> 문서 작성 직전 HEAD: `242326a082cfbe5202f0f55cdecc2a5584c0c571`

이 문서는 다음 에이전트가 기존 구현과 검증 결과, 환경 제약, 보안 경계를 파악하고 동일한 작업을 반복하지 않도록 작성했다. 실제 작업을 시작할 때는 이 문서에 적힌 HEAD를 가정하지 말고 반드시 `git status --short --branch`와 `git rev-parse HEAD`로 현재 상태를 다시 확인한다.

## 1. 프로젝트 목표와 현재 범위

최종 목표는 X, YouTube, Instagram의 공개 콘텐츠를 수집하고 하나의 웹 UI에서 사용하는 것이다. 현재까지 구현한 범위는 다음과 같다.

- X 공개 단건 게시물 수집
- X 계정 게시물 discovery adapter (twitter-cli 기반)
- YouTube 공개 단건 영상 metadata collector (yt-dlp 기반)
- Playwright/Chrome for Testing 실행 환경
- Vite 기반 SNS Scope UI scaffold

아직 구현하지 않은 범위:

- X keyword search production 기능
- X account timeline live E2E (credentials 미제공)
- YouTube channel, playlist, keyword search, comments, subtitle/transcript 수집
- Instagram collector
- collector와 frontend 연결
- backend API, database, scheduler, persistence

## 2. 기술 스택

- Node.js 20 계열, ESM (`"type": "module"`)
- npm lockfile 기반 설치 (`npm ci`)
- Vite 7
- Playwright 1.62
- Undici: proxy-aware X HTTP transport
- Cheerio: X 공개 HTML metadata parsing
- 외부 도구(프로젝트 npm dependency 아님)
  - `twitter-cli` 0.8.5: X account post discovery
  - `yt-dlp` 2026.08.19: YouTube video metadata
  - Agent Reach 1.5.0: 도구 조사/doctor 참고용

pipx 도구는 Codex 컨테이너가 바뀌면 유지되지 않을 수 있다. `command -v twitter`, `command -v yt-dlp`, `command -v agent-reach`로 매 Task마다 확인한다.

## 3. 초기 설정

```bash
cd /workspace/sns_scraper
npm ci
npm run install:browser
```

Browser installer는 Playwright metadata에서 요구 Chrome version/revision을 읽고 공식 Chrome for Testing 저장소에서 project-local `.cache/`로 설치한다. 표준 `npx playwright install chromium`은 과거 Codex Cloud에서 Playwright CDN `403 Domain forbidden`으로 실패했으므로 custom installer가 추가됐다.

외부 CLI가 필요한 작업에서는 repository 밖의 pipx 환경에 설치한다.

```bash
pipx install twitter-cli
pipx install "yt-dlp[default]"
pipx install https://github.com/Panniantong/agent-reach/archive/main.zip
```

Agent Reach는 production dependency가 아니다. 도구 discovery, 설치 안내와 doctor를 참고했으며 실제 runtime에서는 upstream 도구를 직접 실행한다.

## 4. 실행 및 검증 명령

```bash
# 기본 회귀 검증
npm ci
npm run install:browser
npm run test:browser
npm run test:x
npm run test:x-account
npm run test:youtube
npm run build
git diff --check

# 실제 X 단건 수집
npm run collect:x -- "https://x.com/jack/status/20"

# X 계정 수집 (두 credential이 명시적으로 제공된 환경에서만)
npm run collect:x-account -- "@jack" --limit 3

# YouTube 단건 수집
npm run collect:youtube -- "https://www.youtube.com/watch?v=M7lc1UVf-VE"
```

검증된 X live 기대값:

```text
post_id = 20
author.username = jack
text = just setting up my twttr
published_at = 2006-03-21T20:50:14.000Z
```

## 5. 디렉터리 구조

```text
collectors/
  x/
    account-errors.mjs
    errors.mjs
    collect-post.mjs
    fetch-post-html.mjs
    parse-post-html.mjs
    collect-account.mjs
    backends/twitter-cli.mjs
  youtube/
    errors.mjs
    parse-url.mjs
    collect-video.mjs
    backends/yt-dlp.mjs
lib/
  browser.mjs
scripts/
  install-browser.sh
  collect-x-post.mjs
  collect-x-account.mjs
  collect-youtube-video.mjs
tests/
  browser-smoke.mjs
  x-collector.test.mjs
  x-account.test.mjs
  youtube-collector.test.mjs
  fixtures/
src/
  main.js
  style.css
index.html
```

## 6. X 단건 collector

### 데이터 흐름

```text
X status URL validation
  → 공개 HTML HTTP GET (Undici, proxy-aware)
  → JSON-LD / schema.org microdata / Open Graph parsing
  → normalized X post JSON
  → 필요한 오류에서만 Playwright DOM fallback
```

지원 URL:

```text
https://x.com/<username>/status/<post_id>
https://twitter.com/<username>/status/<post_id>
```

Query와 fragment는 canonical URL에서 제거한다. 실제 fetch 전 URL validator를 통과하므로 arbitrary host, localhost, private IP, `file:`, `data:` 등의 SSRF 입력은 허용되지 않는다. Redirect도 X/Twitter HTTPS host만 허용한다.

### HTTP-first parser

`collectors/x/fetch-post-html.mjs`는 다음을 적용한다.

- `HTTPS_PROXY`, `https_proxy`, `HTTP_PROXY`, `http_proxy` 순으로 proxy 탐색
- 최대 redirect 5회
- timeout 20초
- 응답 최대 2 MiB
- HTML content-type만 허용
- HTTP 401/403은 `HTTP_BLOCKED`

`collectors/x/parse-post-html.mjs`의 source 우선순위:

- 대상 확인: JSON-LD `SocialMediaPosting` → schema.org microdata → canonical/OG URL
- 본문: JSON-LD `articleBody`/`text` → microdata → `og:description`
- 작성자: JSON-LD author → `og:title` → 입력 username fallback
- 게시시각: machine-readable `datePublished`/`dateCreated`만 사용

대상 post ID가 structured metadata URL과 일치해야 하며, username 충돌도 조용히 덮어쓰지 않는다.

### Browser fallback

다음 HTTP/parser 오류에만 기존 Playwright fallback을 검토한다.

- `HTTP_FETCH_FAILED`
- `HTML_METADATA_NOT_FOUND`
- `POST_NOT_FOUND`
- `EXTRACTION_FAILED`

`HTTP_BLOCKED`에는 불필요한 browser retry를 하지 않는다. DOM fallback은 semantic selector와 target permalink의 status ID를 사용하며 첫 번째 article을 무조건 선택하지 않는다.

### X schema

```json
{
  "schema_version": "1.0",
  "platform": "x",
  "source_url": "...",
  "canonical_url": "...",
  "post_id": "...",
  "author": { "display_name": null, "username": "..." },
  "text": "...",
  "published_at": "...",
  "metrics": {
    "reply_count": null,
    "repost_count": null,
    "like_count": null,
    "bookmark_count": null,
    "view_count": null
  },
  "media": [],
  "collected_at": "..."
}
```

확인할 수 없는 metric을 `0`으로 추정하지 않는다.

## 7. X account collector

### Architecture

```text
Account URL / @username / username
  → twitter-cli user-posts --json discovery
  → post ID 중복 제거 및 canonical URL 생성
  → 기존 collectXPost() 순차 hydration (concurrency 1)
  → account result + partial failures
```

`twitter-cli`는 discovery만 담당하며 single-post metadata를 자체 정규화하지 않는다. Child process는 `spawn`, argument array, `shell: false`를 사용한다.

지원 입력:

```text
https://x.com/jack
https://twitter.com/jack
@jack
jack
```

기본 limit 5, 최대 20이다. X system path (`home`, `search`, `i`, `status` 등)는 account로 거부한다.

### Credentials

Live account discovery에는 아래 두 변수가 모두 필요하다.

```text
TWITTER_AUTH_TOKEN
TWITTER_CT0
```

값을 출력하거나 command argument로 전달하지 않는다. Child environment로만 전달한다. credentials가 없으면 `TWITTER_AUTH_REQUIRED`이며 live test는 SKIP한다. 브라우저 cookie DB 자동 읽기, 로그인 자동화, session 복사는 금지한다.

### Partial failure

발견한 post 중 일부 hydration이 실패해도 전체 결과를 버리지 않는다. `posts`와 `{ url, code, message }` 형태의 `failures`로 분리하며 stack trace는 결과에 포함하지 않는다.

## 8. YouTube 단건 collector

### Architecture

```text
YouTube video URL validation
  → yt-dlp --dump-single-json metadata extraction
  → video ID 일치 검증
  → normalized YouTube JSON
```

지원 URL:

```text
https://www.youtube.com/watch?v=<11-char-id>
https://youtube.com/watch?v=<11-char-id>
https://m.youtube.com/watch?v=<11-char-id>
https://youtu.be/<11-char-id>
```

Phase 1에서는 channel, playlist, search, shorts special handling을 지원하지 않는다.

Backend argument:

```text
--dump-single-json
--skip-download
--no-playlist
--js-runtimes node
<canonical URL>
```

Child process는 `spawn`, `shell: false`, timeout 30초를 사용한다. stdout 최대 5 MiB, stderr 보관 최대 256 KiB이다. Cookie, login, media/subtitle/comments 다운로드 option은 사용하지 않는다.

### Mapping

- `video_id`: yt-dlp `id`; URL ID와 다르면 `VIDEO_ID_MISMATCH`
- `title`: `title` (필수)
- channel name: `channel` → `uploader` fallback
- channel ID: `channel_id` → `uploader_id`
- channel URL: `channel_url` → `uploader_url`
- `published_at`: `timestamp` → `release_timestamp`
- `upload_date`만 있으면 임의 `T00:00:00Z`를 만들지 않고 실패
- metrics: 숫자로 제공된 값만 저장, 그 외 `null`
- thumbnail: HTTPS `thumbnail` → 마지막 유효 `thumbnails[].url`
- tags/categories: array일 때만 보존
- `is_live`: boolean 또는 의미가 명확한 `live_status`만 변환, unknown은 `null`

### 현재 live blocker

마지막 live 검증에서 아래 세 host 모두 Codex Cloud Envoy proxy가 HTTPS CONNECT 단계에서 `403 Forbidden`을 반환했다.

```text
www.youtube.com
youtube.com
youtu.be
```

따라서 `M7lc1UVf-VE`의 실제 yt-dlp metadata와 normalized live JSON은 아직 검증되지 않았다. Deterministic tests만 PASS한 상태다. 다음 에이전트는 먼저 아래 명령으로 network policy 변경 여부를 확인하고, CONNECT가 계속 403이면 application code를 수정하지 않는다.

```bash
curl -I --max-time 20 https://www.youtube.com
curl -I --max-time 20 https://youtube.com
curl -I --max-time 20 https://youtu.be
```

Network가 열리면 다음 순서로 live mapping을 검증한다.

```bash
yt-dlp --dump-single-json --skip-download --no-playlist --js-runtimes node \
  "https://www.youtube.com/watch?v=M7lc1UVf-VE"
npm run collect:youtube -- "https://www.youtube.com/watch?v=M7lc1UVf-VE"
```

Fixture 값을 live 결과로 보고하면 안 된다.

## 9. Browser 환경

`lib/browser.mjs` executable 우선순위:

1. `CHROME_EXECUTABLE_PATH`
2. `.cache/chrome-for-testing/<version>/chrome-linux64/chrome`
3. Playwright 기본 Chromium

`scripts/install-browser.sh`는 Linux x86_64용이다. 필요한 shared library가 없을 때만 `npx playwright install-deps chromium`을 실행한다. `.cache/`, `node_modules/`, `dist/`는 Git에 포함하지 않는다.

과거 Codex Cloud TLS inspection 환경에서는 curl/Node가 proxy CA를 신뢰하지만 Chrome user NSS DB가 비어 있어 `ERR_CERT_AUTHORITY_INVALID`가 발생했다. 당시 환경이 명시적으로 제공한 `CODEX_PROXY_CERT`를 검증한 후 `$HOME/.pki/nssdb`에 public CA만 import하여 해결했다. CA, NSS DB, machine-specific path는 repository에 commit하면 안 된다.

## 10. UI 상태

`index.html`, `src/main.js`, `src/style.css`에는 Korean SNS Scope dashboard scaffold가 있다.

- X / YouTube / Instagram 탭
- 통합 검색 mock UI
- 최근 수집 mock 목록
- metric cards
- channel integration panel
- 반응형 sidebar/mobile layout

아직 실제 collector와 연결되지 않았다. Collector 작업 중 UI를 불필요하게 수정하지 않는다.

## 11. 보안 및 비범위 원칙

다음은 기존 작업 전반에서 금지했고 앞으로도 명시적 요구/보안 설계 없이 추가하지 않는다.

- username/password 자동 로그인
- Chrome cookie DB 자동 읽기 또는 복사
- Cookie/session/token을 Git, fixture, log에 저장
- CAPTCHA/anti-bot 우회, stealth plugin, fingerprint spoofing
- proxy rotation, VPN, tunnel, certificate validation 비활성화
- X private API/GraphQL reverse engineering
- YouTube cookies 또는 Google login
- 임의 URL fetch/SSRF
- media binary 다운로드

`.env`와 `.env.*`는 ignore되어 있으며 `.env.example`만 허용된다. Secret 값은 존재 여부만 보고한다.

## 12. Agent Reach 조사 결과

참고 자료:

- https://github.com/Panniantong/Agent-Reach
- https://github.com/Panniantong/Agent-Reach/blob/main/docs/README_ko.md
- https://github.com/Panniantong/Agent-Reach/blob/main/agent_reach/skill/references/social.md

적용한 원칙:

- Agent Reach를 runtime framework로 결합하지 않는다.
- upstream tool을 직접 adapter로 호출한다.
- X account timeline은 `twitter-cli`를 discovery backend로 사용한다.
- YouTube metadata/subtitle/search 후보는 `yt-dlp`다.
- Instagram은 OpenCLI + 사용자가 이미 로그인한 desktop Chrome session 방식이다.

Instagram OpenCLI 방식은 일반 desktop login session이 없는 Codex Cloud에 부적합하다. Cookie 자동 추출/로그인을 구현하지 말고 향후 local/desktop backend로 분리하는 것이 현실적이다.

## 13. 테스트 fixture의 의미

- `tests/fixtures/x-post.html`: 최소 JSON-LD/OG/microdata parser 검증용
- `tests/fixtures/twitter-user-posts.json`: twitter-cli JSON discovery parser 검증용
- `tests/fixtures/youtube-video.json`: yt-dlp mapping 검증용

Fixture는 network-independent deterministic test 데이터다. 실제 live 결과 또는 최신 platform 응답이라고 주장하면 안 되며, 전체 실제 페이지/response를 repository에 저장하지 않는다.

## 14. 알려진 blockers

### X account live

```text
X account timeline live verification requires explicitly configured
TWITTER_AUTH_TOKEN and TWITTER_CT0.
```

두 값이 없으면 adapter deterministic tests까지만 PASS로 보고하고 account live는 SKIP한다.

### YouTube live

```text
Codex Cloud Envoy egress proxy returned HTTP 403 at CONNECT for
www.youtube.com, youtube.com, and youtu.be.
```

Allowlist가 갱신됐다는 안내가 있더라도 먼저 curl과 raw yt-dlp로 재검증한다. 최초 YouTube host가 막혀 후속 host가 관측되지 않았다면 `youtubei.googleapis.com` 같은 추가 domain을 추측으로 요구하지 않는다.

## 15. 권장 다음 작업 순서

1. 현재 Git 상태와 runtime/tool 버전을 다시 확인한다.
2. 전체 deterministic/browser/build regression을 실행한다.
3. YouTube egress가 열렸다면 raw yt-dlp live metadata를 먼저 확보한다.
4. 실제 field (`timestamp`, channel/uploader, metrics, thumbnail, live status)를 현재 mapping과 비교한다.
5. live evidence가 다를 때만 YouTube normalizer와 fixture를 최소 수정한다.
6. YouTube 단건 live E2E가 성공한 뒤에만 channel/search/subtitle Phase를 별도 설계한다.
7. X account credentials가 명시적으로 제공되면 limit 3으로 twitter-cli discovery와 순차 hydration을 검증한다.
8. Instagram은 Codex Cloud에서 억지로 구현하지 말고 local/desktop execution model부터 결정한다.

## 16. 작업 완료 체크리스트

- [ ] `git status --short --branch`로 예상치 못한 변경 확인
- [ ] `npm ci`
- [ ] `npm run install:browser`
- [ ] `npm run test:browser`
- [ ] `npm run test:x`
- [ ] `npm run test:x-account`
- [ ] `npm run test:youtube`
- [ ] X 단건 live regression
- [ ] 가능하면 YouTube raw/live regression
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] `index.html`, `src/main.js`, `src/style.css` 불필요한 변경 없음
- [ ] credential/cookie/CA/cache/binary가 Git에 포함되지 않음

