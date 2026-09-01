import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bindXPostFeature,
  formatMetric,
  isSupportedXPostUrl,
  renderXPostState,
} from '../src/x-post-feature.js';

function element() {
  return { textContent: '', innerHTML: 'untouched', hidden: true, disabled: false, href: '', dataset: {} };
}

function createView() {
  return {
    panel: element(), result: element(), error: element(), submit: element(), status: element(),
    errorCode: element(), errorMessage: element(), displayName: element(), username: element(),
    text: element(), publishedAt: element(), canonicalUrl: element(),
    metrics: {
      reply_count: element(), repost_count: element(), like_count: element(),
      bookmark_count: element(), view_count: element(),
    },
  };
}

function createForm() {
  return {
    listener: null,
    addEventListener(name, listener) {
      assert.equal(name, 'submit');
      this.listener = listener;
    },
  };
}

const post = {
  platform: 'x',
  canonical_url: 'https://x.com/jack/status/20',
  author: { display_name: '<img src=x onerror=alert(1)>', username: 'jack' },
  text: '<script>alert(1)</script>just setting up my twttr',
  published_at: '2006-03-21T20:50:14.000Z',
  metrics: { reply_count: null, repost_count: 12, like_count: null, bookmark_count: null, view_count: null },
};

test('validates only supported X single-post URLs and formats missing metrics as a dash', () => {
  assert.equal(isSupportedXPostUrl('https://x.com/jack/status/20'), true);
  assert.equal(isSupportedXPostUrl('https://twitter.com/jack/status/20?s=1'), true);
  assert.equal(isSupportedXPostUrl('https://x.com/jack'), false);
  assert.equal(isSupportedXPostUrl('https://example.com/jack/status/20'), false);
  assert.equal(formatMetric(null), '—');
  assert.equal(formatMetric(0), '0');
});

test('renders external post fields through textContent and preserves null metrics', () => {
  const view = createView();
  renderXPostState(view, { type: 'success', data: post });
  assert.equal(view.text.textContent, post.text);
  assert.equal(view.displayName.textContent, post.author.display_name);
  assert.equal(view.text.innerHTML, 'untouched');
  assert.equal(view.metrics.reply_count.textContent, '—');
  assert.equal(view.metrics.repost_count.textContent, '12');
  assert.equal(view.canonicalUrl.href, post.canonical_url);
});

test('submits a valid X URL, exposes loading, and renders the API result', async () => {
  const form = createForm();
  const view = createView();
  let resolveResponse;
  const fetchImpl = async (url, options) => {
    assert.equal(url, '/api/x/post');
    assert.deepEqual(JSON.parse(options.body), { url: post.canonical_url });
    return new Promise((resolve) => { resolveResponse = () => resolve({ ok: true, json: async () => ({ ok: true, data: post }) }); });
  };
  bindXPostFeature({ form, input: { value: post.canonical_url }, getSelectedSource: () => 'x', view, fetchImpl });
  const submission = form.listener({ preventDefault() {} });
  assert.equal(view.panel.dataset.state, 'loading');
  assert.equal(view.submit.disabled, true);
  resolveResponse();
  await submission;
  assert.equal(view.panel.dataset.state, 'success');
  assert.equal(view.text.textContent, post.text);
});

test('renders unsupported input and API errors without making unsafe requests', async () => {
  const form = createForm();
  const view = createView();
  let calls = 0;
  bindXPostFeature({ form, input: { value: '#marketing' }, getSelectedSource: () => 'x', view, fetchImpl: async () => { calls += 1; } });
  await form.listener({ preventDefault() {} });
  assert.equal(calls, 0);
  assert.equal(view.panel.dataset.state, 'error');
  assert.equal(view.errorCode.textContent, 'UNSUPPORTED_X_INPUT');

  form.listener = null;
  bindXPostFeature({
    form,
    input: { value: post.canonical_url },
    getSelectedSource: () => 'x',
    view,
    fetchImpl: async () => ({ ok: false, json: async () => ({ ok: false, error: { code: 'HTTP_BLOCKED', message: 'Blocked.' } }) }),
  });
  await form.listener({ preventDefault() {} });
  assert.equal(view.errorCode.textContent, 'HTTP_BLOCKED');
  assert.equal(view.errorMessage.textContent, 'Blocked.');
});
