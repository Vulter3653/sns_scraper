import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normalizeYouTubeMetadata,
  normalizeYouTubePublishedAt,
} from '../collectors/youtube/collect-video.mjs';
import { buildYtDlpArgs, extractWithYtDlp } from '../collectors/youtube/backends/yt-dlp.mjs';
import { YouTubeCollectorError } from '../collectors/youtube/errors.mjs';
import { parseYouTubeVideoUrl } from '../collectors/youtube/parse-url.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/youtube-video.json', import.meta.url), 'utf8'));

test('parses watch URLs and removes unrelated query parameters', () => {
  for (const host of ['www.youtube.com', 'youtube.com', 'm.youtube.com']) {
    assert.deepEqual(parseYouTubeVideoUrl(`https://${host}/watch?v=M7lc1UVf-VE&t=10&list=abc`), {
      sourceUrl: `https://${host}/watch?v=M7lc1UVf-VE&t=10&list=abc`,
      canonicalUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      videoId: 'M7lc1UVf-VE',
    });
  }
});

test('parses youtu.be URLs and canonicalizes tracking parameters', () => {
  assert.equal(
    parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE?si=fixture').canonicalUrl,
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
  );
});

test('rejects invalid IDs, unsupported hosts, channels, playlists, and schemes', () => {
  for (const input of [
    'not a URL',
    'https://www.youtube.com/watch?v=short',
    'https://example.com/watch?v=M7lc1UVf-VE',
    'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
    'https://www.youtube.com/playlist?list=fixture',
    'https://www.youtube.com/shorts/M7lc1UVf-VE',
    'http://127.0.0.1/watch?v=M7lc1UVf-VE',
    'file:///tmp/video',
  ]) {
    assert.throws(() => parseYouTubeVideoUrl(input), (error) => error instanceof YouTubeCollectorError);
  }
});

test('normalizes a yt-dlp JSON fixture without inventing optional metrics', () => {
  const parsedUrl = parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE');
  const result = normalizeYouTubeMetadata(parsedUrl, fixture, '2026-08-26T16:00:00.000Z');
  assert.equal(result.video_id, 'M7lc1UVf-VE');
  assert.equal(result.channel.name, 'Google for Developers');
  assert.equal(result.published_at, new Date(fixture.timestamp * 1000).toISOString());
  assert.equal(result.metrics.view_count, 1000);
  assert.equal(result.metrics.like_count, null);
  assert.equal(result.metrics.comment_count, null);
  assert.deepEqual(result.tags, ['YouTube', 'Developers']);
  assert.deepEqual(result.categories, ['Science & Technology']);
  assert.equal(result.thumbnail_url, fixture.thumbnail);
  assert.equal(result.is_live, false);
});

test('rejects a yt-dlp video ID mismatch', () => {
  const parsedUrl = parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE');
  assert.throws(() => normalizeYouTubeMetadata(parsedUrl, { ...fixture, id: 'dQw4w9WgXcQ' }), (error) => (
    error.code === 'VIDEO_ID_MISMATCH'
  ));
});

test('normalizes timestamp priorities and does not invent a time for date-only upload_date', () => {
  assert.equal(
    normalizeYouTubePublishedAt({ timestamp: 1_700_000_000, release_timestamp: 1_600_000_000 }),
    '2023-11-14T22:13:20.000Z',
  );
  assert.equal(normalizeYouTubePublishedAt({ release_timestamp: 1_600_000_000 }), '2020-09-13T12:26:40.000Z');
  assert.equal(normalizeYouTubePublishedAt({ upload_date: '20260826' }), null);
});

test('uses uploader fallbacks and the last valid thumbnail without coercing arrays', () => {
  const parsedUrl = parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE');
  const metadata = {
    ...fixture,
    channel: null,
    channel_id: null,
    channel_url: null,
    uploader: 'Fallback Uploader',
    uploader_id: 'fallback-id',
    uploader_url: 'https://www.youtube.com/@fallback',
    thumbnail: null,
    thumbnails: [{ url: 'invalid' }, { url: 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg' }],
    tags: 'not-an-array',
    categories: null,
  };
  const result = normalizeYouTubeMetadata(parsedUrl, metadata);
  assert.deepEqual(result.channel, {
    id: 'fallback-id',
    name: 'Fallback Uploader',
    url: 'https://www.youtube.com/@fallback',
  });
  assert.equal(result.thumbnail_url, 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg');
  assert.deepEqual(result.tags, []);
  assert.deepEqual(result.categories, []);
});

test('builds shell-free metadata-only yt-dlp arguments', () => {
  const url = 'https://www.youtube.com/watch?v=M7lc1UVf-VE';
  const args = buildYtDlpArgs(url);
  assert.deepEqual(args, [
    '--dump-single-json', '--skip-download', '--no-playlist', '--js-runtimes', 'node', url,
  ]);
  assert.equal(args.some((argument) => /cookies|comments|write-subs/.test(argument)), false);
});

test('sanitizes malformed yt-dlp JSON errors', async () => {
  const secret = 'raw-secret-output';
  await assert.rejects(extractWithYtDlp('https://www.youtube.com/watch?v=M7lc1UVf-VE', {
    runner: async () => secret,
  }), (error) => {
    assert.equal(error.code, 'YOUTUBE_EXTRACTION_FAILED');
    assert.equal(error.message.includes(secret), false);
    assert.equal(JSON.stringify(error.toJSON()).includes(secret), false);
    return true;
  });
});
