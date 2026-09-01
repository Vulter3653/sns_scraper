import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createNormalizedXPost,
  parseMetricCount,
  parseXPostUrl,
  XCollectorError,
} from '../collectors/x/collect-post.mjs';
import { fetchXPostHtml } from '../collectors/x/fetch-post-html.mjs';
import { parseXPostHtml } from '../collectors/x/parse-post-html.mjs';

const fixtureHtml = fs.readFileSync(new URL('./fixtures/x-post.html', import.meta.url), 'utf8');

test('parses and canonicalizes an x.com post URL', () => {
  assert.deepEqual(parseXPostUrl('https://x.com/example/status/123456789?s=20#post'), {
    sourceUrl: 'https://x.com/example/status/123456789?s=20#post',
    canonicalUrl: 'https://x.com/example/status/123456789',
    username: 'example',
    postId: '123456789',
  });
});

test('parses a twitter.com post URL', () => {
  assert.equal(
    parseXPostUrl('https://twitter.com/XDevelopers/status/987654321').canonicalUrl,
    'https://x.com/XDevelopers/status/987654321',
  );
});

test('rejects invalid and unsupported URLs before browser launch', () => {
  assert.throws(() => parseXPostUrl('not a url'), (error) => (
    error instanceof XCollectorError && error.code === 'INVALID_URL'
  ));
  assert.throws(() => parseXPostUrl('https://example.com/user/status/123'), (error) => (
    error instanceof XCollectorError && error.code === 'UNSUPPORTED_URL'
  ));
  assert.throws(() => parseXPostUrl('https://x.com/example'), (error) => (
    error instanceof XCollectorError && error.code === 'UNSUPPORTED_URL'
  ));
});

test('parses only unambiguous metric counts', () => {
  assert.equal(parseMetricCount('1.2K'), 1_200);
  assert.equal(parseMetricCount('3M'), 3_000_000);
  assert.equal(parseMetricCount('1,234'), 1_234);
  assert.equal(parseMetricCount('likes 12'), null);
  assert.equal(parseMetricCount(null), null);
});

test('creates the normalized schema without inventing optional values', () => {
  const parsedUrl = parseXPostUrl('https://x.com/example/status/123');
  const result = createNormalizedXPost(parsedUrl, {
    text: 'A fixture post.\nSecond line.',
    username: 'example',
    publishedAt: '2026-08-26T12:00:00.000Z',
  }, '2026-08-26T12:01:00.000Z');

  assert.deepEqual(result, {
    schema_version: '1.0',
    platform: 'x',
    source_url: 'https://x.com/example/status/123',
    canonical_url: 'https://x.com/example/status/123',
    post_id: '123',
    author: { display_name: null, username: 'example' },
    text: 'A fixture post.\nSecond line.',
    published_at: '2026-08-26T12:00:00.000Z',
    metrics: {
      reply_count: null,
      repost_count: null,
      like_count: null,
      bookmark_count: null,
      view_count: null,
    },
    media: [],
    collected_at: '2026-08-26T12:01:00.000Z',
  });
});

test('finds the target SocialMediaPosting across malformed, multiple, and @graph JSON-LD blocks', () => {
  const parsedUrl = parseXPostUrl('https://x.com/fixture_user/status/123456789');
  assert.deepEqual(parseXPostHtml(fixtureHtml, parsedUrl), {
    displayName: 'Fixture & Author',
    username: 'fixture_user',
    text: 'Structured & decoded text\nSecond line',
    publishedAt: '2026-08-26T12:00:00.000Z',
    media: [{ type: 'image', url: 'https://pbs.twimg.com/media/fixture.jpg', alt: null }],
  });
});

test('rejects structured metadata for a different status ID', () => {
  const parsedUrl = parseXPostUrl('https://x.com/fixture_user/status/555');
  assert.throws(() => parseXPostHtml(fixtureHtml, parsedUrl), (error) => (
    error instanceof XCollectorError && error.code === 'POST_NOT_FOUND'
  ));
});

test('uses decoded Open Graph metadata with target microdata', () => {
  const parsedUrl = parseXPostUrl('https://x.com/fixture_user/status/42');
  const html = `
    <meta property="og:url" content="https://x.com/fixture_user/status/42">
    <meta property="og:title" content="Fixture &amp; Author (@fixture_user) on X">
    <meta property="og:description" content="Text &amp; more">
    <article itemid="https://x.com/i/status/42" itemtype="https://schema.org/SocialMediaPosting">
      <meta itemprop="datePublished" content="2026-08-26T12:00:00Z">
    </article>`;
  const result = parseXPostHtml(html, parsedUrl);
  assert.equal(result.displayName, 'Fixture & Author');
  assert.equal(result.text, 'Text & more');
  assert.equal(result.publishedAt, '2026-08-26T12:00:00.000Z');
});

test('uses the public Open Graph article timestamp when structured post metadata is absent', () => {
  const parsedUrl = parseXPostUrl('https://x.com/jack/status/20');
  const html = `
    <link rel="canonical" href="https://x.com/jack/status/20">
    <meta property="og:url" content="https://x.com/jack/status/20">
    <meta property="og:title" content="jack (@jack) on X">
    <meta property="og:description" content="just setting up my twttr">
    <meta property="article:published_time" content="2006-03-21T20:50:14.000Z">`;

  assert.deepEqual(parseXPostHtml(html, parsedUrl), {
    displayName: 'jack',
    username: 'jack',
    text: 'just setting up my twttr',
    publishedAt: '2006-03-21T20:50:14.000Z',
    media: [],
  });
});

test('fails when required public metadata is missing', () => {
  const parsedUrl = parseXPostUrl('https://x.com/fixture_user/status/42');
  const html = '<meta property="og:url" content="https://x.com/fixture_user/status/42">';
  assert.throws(() => parseXPostHtml(html, parsedUrl), (error) => (
    error instanceof XCollectorError && error.code === 'EXTRACTION_FAILED'
  ));
});

test('HTTP retrieval rejects arbitrary targets and unsafe redirects', async () => {
  await assert.rejects(fetchXPostHtml('http://127.0.0.1/status/1'), (error) => (
    error instanceof XCollectorError && error.code === 'UNSUPPORTED_URL'
  ));
  await assert.rejects(fetchXPostHtml('https://x.com/user/status/1', {
    proxyUrl: '',
    fetchImpl: async () => new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/private' },
    }),
  }), (error) => error instanceof XCollectorError && error.code === 'UNSUPPORTED_URL');
});
