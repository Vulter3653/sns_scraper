import { extractWithYtDlp } from './backends/yt-dlp.mjs';
import { YouTubeCollectorError } from './errors.mjs';
import { parseYouTubeVideoUrl } from './parse-url.mjs';

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeYouTubePublishedAt(metadata) {
  for (const value of [metadata.timestamp, metadata.release_timestamp]) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value * 1000).toISOString();
    }
  }
  // upload_date is date-only (YYYYMMDD); inventing a UTC time would change its meaning.
  return null;
}

function selectThumbnail(metadata) {
  if (typeof metadata.thumbnail === 'string' && /^https:\/\//.test(metadata.thumbnail)) return metadata.thumbnail;
  if (!Array.isArray(metadata.thumbnails)) return null;
  return metadata.thumbnails
    .filter((thumbnail) => typeof thumbnail?.url === 'string' && /^https:\/\//.test(thumbnail.url))
    .at(-1)?.url ?? null;
}

export function normalizeYouTubeMetadata(parsedUrl, metadata, collectedAt = new Date().toISOString()) {
  const extractedId = typeof metadata.id === 'string' ? metadata.id : null;
  if (extractedId !== parsedUrl.videoId) {
    throw new YouTubeCollectorError('VIDEO_ID_MISMATCH', 'yt-dlp returned metadata for a different YouTube video ID.');
  }

  const title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
  const channelName = [metadata.channel, metadata.uploader]
    .find((value) => typeof value === 'string' && value.trim())?.trim() ?? null;
  const publishedAt = normalizeYouTubePublishedAt(metadata);
  if (!title || !channelName || !publishedAt) {
    throw new YouTubeCollectorError(
      'YOUTUBE_EXTRACTION_FAILED',
      'Required YouTube title, channel, or machine-readable publication timestamp is missing.',
    );
  }

  const isLive = typeof metadata.is_live === 'boolean'
    ? metadata.is_live
    : metadata.live_status === 'not_live' ? false
      : ['is_live', 'is_upcoming', 'post_live'].includes(metadata.live_status) ? true : null;

  return {
    schema_version: '1.0',
    platform: 'youtube',
    source_url: parsedUrl.sourceUrl,
    canonical_url: parsedUrl.canonicalUrl,
    video_id: parsedUrl.videoId,
    title,
    description: typeof metadata.description === 'string' ? metadata.description : null,
    channel: {
      id: typeof metadata.channel_id === 'string' ? metadata.channel_id : metadata.uploader_id ?? null,
      name: channelName,
      url: typeof metadata.channel_url === 'string' ? metadata.channel_url : metadata.uploader_url ?? null,
    },
    published_at: publishedAt,
    duration_seconds: nullableNumber(metadata.duration),
    metrics: {
      view_count: nullableNumber(metadata.view_count),
      like_count: nullableNumber(metadata.like_count),
      comment_count: nullableNumber(metadata.comment_count),
    },
    thumbnail_url: selectThumbnail(metadata),
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag) => typeof tag === 'string') : [],
    categories: Array.isArray(metadata.categories)
      ? metadata.categories.filter((category) => typeof category === 'string') : [],
    is_live: isLive,
    collected_at: collectedAt,
  };
}

export async function collectYouTubeVideo(input, options = {}) {
  const parsedUrl = parseYouTubeVideoUrl(input);
  const metadata = await (options.extractMetadata ?? extractWithYtDlp)(parsedUrl.canonicalUrl, options.ytDlp);
  return normalizeYouTubeMetadata(parsedUrl, metadata, options.collectedAt);
}
