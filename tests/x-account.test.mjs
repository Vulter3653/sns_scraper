import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  collectXAccount,
  parseXAccount,
  validateAccountLimit,
} from '../collectors/x/collect-account.mjs';
import { XAccountCollectorError } from '../collectors/x/account-errors.mjs';
import {
  buildTwitterCliArgs,
  discoverWithTwitterCli,
  parseTwitterCliUserPosts,
} from '../collectors/x/backends/twitter-cli.mjs';

const cliFixture = fs.readFileSync(new URL('./fixtures/twitter-user-posts.json', import.meta.url), 'utf8');

test('parses account URLs, @usernames, and plain usernames', () => {
  for (const input of ['https://x.com/jack', 'https://twitter.com/jack', '@jack', 'jack']) {
    assert.deepEqual(parseXAccount(input), {
      username: 'jack',
      canonicalUrl: 'https://x.com/jack',
    });
  }
});

test('rejects invalid usernames and X system paths', () => {
  for (const input of [
    '', '@bad-name', 'https://example.com/jack', 'https://x.com/jack/status/20',
    'https://x.com/search', 'home', 'explore', 'messages', 'settings', 'i', 'status',
  ]) {
    assert.throws(() => parseXAccount(input), (error) => (
      error instanceof XAccountCollectorError && error.code === 'INVALID_ACCOUNT'
    ));
  }
});

test('validates the default and bounded account limits', () => {
  assert.equal(validateAccountLimit(), 5);
  assert.equal(validateAccountLimit('20'), 20);
  for (const value of [0, -1, 'abc', 21, 1000, 1.5]) {
    assert.throws(() => validateAccountLimit(value), (error) => error.code === 'INVALID_ACCOUNT');
  }
});

test('parses twitter-cli JSON, removes duplicates, and creates canonical post URLs', () => {
  assert.deepEqual(parseTwitterCliUserPosts(cliFixture, 'jack'), [
    { postId: '20', username: 'jack', url: 'https://x.com/jack/status/20' },
    { postId: '21', username: 'jack', url: 'https://x.com/jack/status/21' },
  ]);
});

test('builds a shell-free twitter-cli argument array', () => {
  assert.deepEqual(buildTwitterCliArgs('jack', 3), ['user-posts', 'jack', '--max', '3', '--json']);
});

test('requires both credentials without exposing secret values', async () => {
  const secret = 'must-not-appear';
  await assert.rejects(discoverWithTwitterCli('jack', 3, {
    env: { TWITTER_AUTH_TOKEN: secret },
  }), (error) => {
    assert.equal(error.code, 'TWITTER_AUTH_REQUIRED');
    assert.equal(error.message.includes(secret), false);
    assert.equal(JSON.stringify(error.toJSON()).includes(secret), false);
    return true;
  });
});

test('passes secrets through child environment, never command arguments', async () => {
  const env = { TWITTER_AUTH_TOKEN: 'auth-secret', TWITTER_CT0: 'ct0-secret' };
  let invocation;
  const result = await discoverWithTwitterCli('jack', 2, {
    env,
    runner: async (details) => {
      invocation = details;
      return cliFixture;
    },
  });
  assert.deepEqual(invocation.args, ['user-posts', 'jack', '--max', '2', '--json']);
  assert.equal(invocation.args.join(' ').includes('secret'), false);
  assert.equal(invocation.env, env);
  assert.equal(result.length, 2);
});

test('keeps sequential hydration failures as partial account results', async () => {
  const hydrationOrder = [];
  const result = await collectXAccount('@jack', {
    limit: 2,
    collectedAt: '2026-08-26T16:00:00.000Z',
    discover: async () => parseTwitterCliUserPosts(cliFixture, 'jack').slice(0, 2),
    collectPost: async (url) => {
      hydrationOrder.push(url);
      if (url.endsWith('/21')) {
        throw new Error('Fixture hydration failure');
      }
      return { schema_version: '1.0', platform: 'x', canonical_url: url, post_id: '20' };
    },
  });

  assert.deepEqual(hydrationOrder, [
    'https://x.com/jack/status/20',
    'https://x.com/jack/status/21',
  ]);
  assert.equal(result.discovered_count, 2);
  assert.equal(result.collected_count, 1);
  assert.equal(result.failed_count, 1);
  assert.equal(result.posts.length, 1);
  assert.deepEqual(result.failures, [{
    url: 'https://x.com/jack/status/21',
    code: 'EXTRACTION_FAILED',
    message: 'Fixture hydration failure',
  }]);
});
