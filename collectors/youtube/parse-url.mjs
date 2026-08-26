import { YouTubeCollectorError } from './errors.mjs';

const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeVideoUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new YouTubeCollectorError('INVALID_YOUTUBE_URL', 'A YouTube video URL is required.');
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new YouTubeCollectorError('INVALID_YOUTUBE_URL', 'The supplied value is not a valid URL.');
  }

  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new YouTubeCollectorError('UNSUPPORTED_YOUTUBE_URL', 'Only public HTTPS YouTube video URLs are supported.');
  }

  let videoId;
  if (WATCH_HOSTS.has(host) && url.pathname === '/watch') {
    videoId = url.searchParams.get('v');
  } else if (host === 'youtu.be' && url.pathname.split('/').filter(Boolean).length === 1) {
    [videoId] = url.pathname.split('/').filter(Boolean);
  } else {
    throw new YouTubeCollectorError(
      'UNSUPPORTED_YOUTUBE_URL',
      'Only YouTube watch and youtu.be single-video URLs are supported.',
    );
  }

  if (!VIDEO_ID_PATTERN.test(videoId ?? '')) {
    throw new YouTubeCollectorError('INVALID_YOUTUBE_URL', 'The YouTube video ID is invalid.');
  }

  return {
    sourceUrl: input,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
  };
}
