import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { XCollectorError } from '../collectors/x/errors.mjs';
import { createApiServer } from '../server/x-post-api.mjs';

const fixturePost = {
  schema_version: '1.0',
  platform: 'x',
  canonical_url: 'https://x.com/jack/status/20',
  post_id: '20',
  author: { display_name: 'jack', username: 'jack' },
  text: 'just setting up my twttr',
  published_at: '2006-03-21T20:50:14.000Z',
  metrics: { reply_count: null, repost_count: null, like_count: null, bookmark_count: null, view_count: null },
};

async function withServer(collectPost, callback) {
  const server = createApiServer({ collectPost });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function postJson(baseUrl, body, headers = { 'content-type': 'application/json' }) {
  return fetch(`${baseUrl}/api/x/post`, { method: 'POST', headers, body });
}

test('returns a normalized X post for a valid request', async () => {
  await withServer(async (url) => ({ ...fixturePost, source_url: url }), async (baseUrl) => {
    const response = await postJson(baseUrl, JSON.stringify({ url: fixturePost.canonical_url }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, data: { ...fixturePost, source_url: fixturePost.canonical_url } });
  });
});

test('rejects invalid bodies and non-X targets before collection', async () => {
  let calls = 0;
  await withServer(async () => { calls += 1; }, async (baseUrl) => {
    for (const request of [
      () => postJson(baseUrl, '{'),
      () => postJson(baseUrl, JSON.stringify({ url: fixturePost.canonical_url, extra: true })),
      () => postJson(baseUrl, JSON.stringify({ url: 'https://example.com/status/20' })),
      () => postJson(baseUrl, JSON.stringify({ url: fixturePost.canonical_url }), { 'content-type': 'text/plain' }),
    ]) {
      const response = await request();
      assert.ok(response.status >= 400 && response.status < 500);
      assert.equal((await response.json()).ok, false);
    }
    assert.equal(calls, 0);
  });
});

test('preserves known collector errors without leaking a stack', async () => {
  await withServer(async () => {
    throw new XCollectorError('HTTP_BLOCKED', 'Public X HTML was blocked.');
  }, async (baseUrl) => {
    const response = await postJson(baseUrl, JSON.stringify({ url: fixturePost.canonical_url }));
    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.deepEqual(payload, {
      ok: false,
      error: { code: 'HTTP_BLOCKED', message: 'Public X HTML was blocked.' },
    });
    assert.equal('stack' in payload.error, false);
  });
});

test('sanitizes unexpected server errors', async () => {
  await withServer(async () => { throw new Error('private failure detail'); }, async (baseUrl) => {
    const response = await postJson(baseUrl, JSON.stringify({ url: fixturePost.canonical_url }));
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.equal(text.includes('private failure detail'), false);
    assert.equal(text.includes('stack'), false);
    assert.deepEqual(JSON.parse(text), {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' },
    });
  });
});
