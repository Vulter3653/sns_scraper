import './style.css';
import { bindXPostFeature } from './x-post-feature.js';

const icons = {
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24"><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trend: '<svg viewBox="0 0 24 24"><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>'
};

document.querySelector('#app').innerHTML = `
  <aside class="sidebar">
    <a class="brand" href="#"><span class="brand-mark"><i></i><i></i><i></i></span><span>SNS <b>Scope</b></span></a>
    <nav>
      <p>WORKSPACE</p>
      <a class="active" href="#">${icons.grid}<span>대시보드</span></a>
      <a href="#search">${icons.search}<span>통합 검색</span></a>
      <a href="#">${icons.clock}<span>수집 기록</span><em>12</em></a>
      <a href="#">${icons.bookmark}<span>저장한 콘텐츠</span></a>
      <p>MANAGE</p>
      <a href="#sources">${icons.settings}<span>연동 관리</span></a>
    </nav>
    <div class="sidebar-card">
      <div class="pulse">${icons.trend}</div>
      <b>Pro 플랜으로 업그레이드</b>
      <span>무제한 수집과 고급 분석을 시작하세요.</span>
      <button>플랜 살펴보기 ${icons.arrow}</button>
    </div>
    <div class="profile"><div class="avatar">MJ</div><div><b>민지 김</b><span>minji@scope.kr</span></div><button>•••</button></div>
  </aside>
  <main>
    <header><button class="mobile-menu">☰</button><div><span>2026년 8월 26일 수요일</span><h1>좋은 오후예요, 민지님 <span>👋</span></h1></div><button class="new-search">${icons.plus} 새 수집 시작</button></header>

    <section class="hero" id="search">
      <div class="hero-copy"><span class="eyebrow"><i></i> SOCIAL INTELLIGENCE</span><h2>세상의 모든 반응을<br><strong>한곳에서 발견하세요.</strong></h2><p>X, YouTube, Instagram의 콘텐츠와 인사이트를<br>하나의 검색으로 빠르게 수집하세요.</p></div>
      <form class="search-panel">
        <div class="source-tabs">
          <button type="button" class="selected" data-source="all"><span>✦</span> 전체</button>
          <button type="button" data-source="x"><b>𝕏</b> X</button>
          <button type="button" data-source="youtube"><b class="yt">▶</b> YouTube</button>
          <button type="button" data-source="instagram"><b class="ig">◎</b> Instagram</button>
        </div>
        <label>${icons.search}<input required placeholder="키워드, 해시태그 또는 URL을 입력하세요"/><button>수집하기 ${icons.arrow}</button></label>
        <div class="suggestions"><span>추천 검색어</span><button type="button">#생성형AI</button><button type="button">브랜드마케팅</button><button type="button">테크트렌드</button></div>
      </form>
    </section>

    <section class="x-live-panel" id="x-result" aria-live="polite">
      <div class="x-live-heading">
        <div><span class="live-badge">LIVE</span><h3>X 단일 게시물</h3></div>
        <p data-x-status>X 탭에서 공개 단일 게시물 URL을 입력하세요.</p>
      </div>
      <div class="x-live-error" data-x-error hidden>
        <strong data-x-error-code></strong>
        <span data-x-error-message></span>
      </div>
      <article class="x-post-result" data-x-result hidden>
        <header>
          <div><strong data-x-display-name></strong><span data-x-username></span></div>
          <time data-x-published-at></time>
        </header>
        <p data-x-text></p>
        <dl>
          <div><dt>답글</dt><dd data-x-metric="reply_count">—</dd></div>
          <div><dt>재게시</dt><dd data-x-metric="repost_count">—</dd></div>
          <div><dt>좋아요</dt><dd data-x-metric="like_count">—</dd></div>
          <div><dt>북마크</dt><dd data-x-metric="bookmark_count">—</dd></div>
          <div><dt>조회</dt><dd data-x-metric="view_count">—</dd></div>
        </dl>
        <a data-x-canonical-url target="_blank" rel="noopener noreferrer"></a>
      </article>
    </section>

    <section class="metrics">
      <article><div class="metric-icon violet">${icons.trend}</div><div><span>전체 수집 콘텐츠 · 데모</span><strong>24,892</strong><small>실제 저장소 미연결</small></div><div class="spark violet-spark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
      <article><div class="metric-icon red">▶</div><div><span>YouTube · 데모</span><strong>8,420</strong><small>collector only</small></div><div class="spark red-spark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
      <article><div class="metric-icon dark">𝕏</div><div><span>X aggregate · 데모</span><strong>10,284</strong><small>단일 게시물만 실제 연결</small></div><div class="spark dark-spark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
      <article><div class="metric-icon pink">◎</div><div><span>Instagram · 데모</span><strong>6,188</strong><small>미구현</small></div><div class="spark pink-spark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
    </section>

    <section class="content-grid">
      <div class="recent">
        <div class="section-head"><div><h3>최근 수집 · 데모</h3><p>저장 기능은 아직 연결되지 않았습니다.</p></div><button>전체보기 ${icons.chevron}</button></div>
        <div class="collection-list">
          <article><div class="collection-icon ai">AI</div><div class="collection-main"><b>생성형 AI 트렌드</b><span>오늘, 오후 2:32 · 3개 채널</span></div><div class="channel-stack"><i class="c-x">𝕏</i><i class="c-y">▶</i><i class="c-i">◎</i></div><strong>1,284 <small>건</small></strong><span class="status">수집 완료</span><button>${icons.chevron}</button></article>
          <article><div class="collection-icon brand">BM</div><div class="collection-main"><b>2026 브랜드 마케팅</b><span>어제, 오전 11:08 · 2개 채널</span></div><div class="channel-stack"><i class="c-y">▶</i><i class="c-i">◎</i></div><strong>856 <small>건</small></strong><span class="status">수집 완료</span><button>${icons.chevron}</button></article>
          <article><div class="collection-icon tech">TC</div><div class="collection-main"><b>테크 컨퍼런스</b><span>8월 24일 · 3개 채널</span></div><div class="channel-stack"><i class="c-x">𝕏</i><i class="c-y">▶</i><i class="c-i">◎</i></div><strong>2,108 <small>건</small></strong><span class="status">수집 완료</span><button>${icons.chevron}</button></article>
        </div>
      </div>
      <aside class="sources" id="sources">
        <div class="section-head"><div><h3>채널 연동</h3><p>수집 채널 상태를 확인하세요.</p></div><button>${icons.settings}</button></div>
        <div class="source-row"><i class="c-x">𝕏</i><div><b>X (Twitter)</b><span><em></em>단일 게시물 사용 가능 · 계정 credential 필요</span></div><strong>LIVE</strong></div>
        <div class="source-row pending"><i class="c-y">▶</i><div><b>YouTube</b><span><em></em>collector only · UI 미연결</span></div><strong>개발 중</strong></div>
        <div class="source-row pending"><i class="c-i">◎</i><div><b>Instagram</b><span><em></em>미구현</span></div><strong>미구현</strong></div>
        <button class="manage">연동 채널 관리하기 ${icons.arrow}</button>
      </aside>
    </section>
    <footer><span>© 2026 SNS Scope</span><span>데이터는 각 플랫폼의 API 정책에 따라 수집됩니다.</span></footer>
  </main>
  <div class="toast" role="status"><b>수집을 시작했어요</b><span></span></div>
`;

const tabs = document.querySelectorAll('.source-tabs button');
tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(item => item.classList.remove('selected'));
  tab.classList.add('selected');
}));

document.querySelectorAll('.suggestions button').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.search-panel input').value = button.textContent;
}));

const form = document.querySelector('.search-panel');
bindXPostFeature({
  form,
  input: form.querySelector('input'),
  getSelectedSource: () => document.querySelector('.source-tabs .selected').dataset.source,
  view: {
    panel: document.querySelector('.x-live-panel'),
    status: document.querySelector('[data-x-status]'),
    result: document.querySelector('[data-x-result]'),
    error: document.querySelector('[data-x-error]'),
    errorCode: document.querySelector('[data-x-error-code]'),
    errorMessage: document.querySelector('[data-x-error-message]'),
    displayName: document.querySelector('[data-x-display-name]'),
    username: document.querySelector('[data-x-username]'),
    text: document.querySelector('[data-x-text]'),
    publishedAt: document.querySelector('[data-x-published-at]'),
    canonicalUrl: document.querySelector('[data-x-canonical-url]'),
    submit: form.querySelector('label button'),
    metrics: Object.fromEntries(
      [...document.querySelectorAll('[data-x-metric]')].map((element) => [element.dataset.xMetric, element]),
    ),
  },
});

document.querySelector('.new-search').addEventListener('click', () => {
  document.querySelector('#search').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => document.querySelector('.search-panel input').focus(), 400);
});

document.querySelector('.mobile-menu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
