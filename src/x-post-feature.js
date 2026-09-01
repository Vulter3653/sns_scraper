export const X_URL_ONLY_MESSAGE = '현재 X에서는 단일 게시물 URL 수집만 지원합니다.';

export function isSupportedXPostUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && ['x.com', 'twitter.com'].includes(url.hostname.toLowerCase())
      && !url.username
      && !url.password
      && !url.port
      && /^\/[A-Za-z0-9_]{1,15}\/status\/\d+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function formatMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR') : '—';
}

function setVisibility(view, state) {
  view.panel.hidden = false;
  view.result.hidden = state !== 'success';
  view.error.hidden = state !== 'error';
  view.submit.disabled = state === 'loading';
  view.panel.dataset.state = state;
}

export function renderXPostState(view, state) {
  setVisibility(view, state.type);
  if (state.type === 'idle') {
    view.status.textContent = 'X 탭에서 공개 단일 게시물 URL을 입력하세요.';
    return;
  }
  if (state.type === 'loading') {
    view.status.textContent = '공개 X 게시물을 수집하고 있습니다…';
    return;
  }
  if (state.type === 'error') {
    view.status.textContent = '수집하지 못했습니다.';
    view.errorCode.textContent = state.code;
    view.errorMessage.textContent = state.message;
    return;
  }

  const post = state.data;
  view.status.textContent = '실제 X 단일 게시물 수집 결과';
  view.displayName.textContent = post.author?.display_name ?? '표시 이름 확인 불가';
  view.username.textContent = `@${post.author?.username ?? 'unknown'}`;
  view.text.textContent = post.text ?? '';
  view.publishedAt.textContent = post.published_at ?? '게시 시각 확인 불가';
  view.canonicalUrl.textContent = post.canonical_url;
  view.canonicalUrl.href = post.canonical_url;
  for (const [key, element] of Object.entries(view.metrics)) {
    element.textContent = formatMetric(post.metrics?.[key]);
  }
}

export async function requestXPost(url, fetchImpl = fetch) {
  const response = await fetchImpl('/api/x/post', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw { code: 'INVALID_API_RESPONSE', message: 'API가 유효한 JSON을 반환하지 않았습니다.' };
  }
  if (!response.ok || payload?.ok !== true) {
    throw {
      code: payload?.error?.code ?? 'API_REQUEST_FAILED',
      message: payload?.error?.message ?? 'X 게시물 수집 요청이 실패했습니다.',
    };
  }
  if (!isSupportedXPostUrl(payload.data?.canonical_url ?? '')) {
    throw { code: 'INVALID_API_RESPONSE', message: 'API가 유효한 X canonical URL을 반환하지 않았습니다.' };
  }
  return payload.data;
}

export function bindXPostFeature({ form, input, getSelectedSource, view, fetchImpl = fetch }) {
  renderXPostState(view, { type: 'idle' });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const source = getSelectedSource();
    const url = input.value.trim();

    if (source !== 'x') {
      renderXPostState(view, {
        type: 'error',
        code: 'FEATURE_NOT_CONNECTED',
        message: '현재 실제 수집은 X 단일 게시물만 지원합니다. X 탭을 선택해 주세요.',
      });
      return;
    }
    if (!isSupportedXPostUrl(url)) {
      renderXPostState(view, { type: 'error', code: 'UNSUPPORTED_X_INPUT', message: X_URL_ONLY_MESSAGE });
      return;
    }

    renderXPostState(view, { type: 'loading' });
    try {
      renderXPostState(view, { type: 'success', data: await requestXPost(url, fetchImpl) });
    } catch (error) {
      renderXPostState(view, {
        type: 'error',
        code: typeof error?.code === 'string' ? error.code : 'API_REQUEST_FAILED',
        message: typeof error?.message === 'string' ? error.message : 'X 게시물 수집 요청이 실패했습니다.',
      });
    }
  });
}
