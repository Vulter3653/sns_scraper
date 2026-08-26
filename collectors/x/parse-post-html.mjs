import * as cheerio from 'cheerio';
import { XCollectorError } from './errors.mjs';

function flattenJsonLd(value, candidates = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenJsonLd(item, candidates));
  } else if (value && typeof value === 'object') {
    candidates.push(value);
    if (value['@graph']) flattenJsonLd(value['@graph'], candidates);
  }
  return candidates;
}

function isSocialMediaPosting(value) {
  const types = Array.isArray(value?.['@type']) ? value['@type'] : [value?.['@type']];
  return types.some((type) => typeof type === 'string' && type.endsWith('SocialMediaPosting'));
}

function statusIdFromValue(value) {
  const values = Array.isArray(value) ? value : [value];
  for (const candidate of values) {
    const raw = typeof candidate === 'string' ? candidate : candidate?.['@id'] ?? candidate?.url;
    if (typeof raw !== 'string') continue;
    const match = raw.match(/\/status\/(\d+)(?:[/?#]|$)/);
    if (match) return match[1];
  }
  return null;
}

function normalizeTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

function authorFromJsonLd(author) {
  const value = Array.isArray(author) ? author[0] : author;
  if (!value || typeof value !== 'object') return {};
  const usernameFromName = typeof value.alternateName === 'string'
    ? value.alternateName.match(/^@?([A-Za-z0-9_]{1,15})$/)?.[1]
    : null;
  return {
    displayName: typeof value.name === 'string' ? value.name.trim() || null : null,
    username: usernameFromName ?? statusIdFromAuthorUrl(value.url ?? value['@id']),
  };
}

function statusIdFromAuthorUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean);
    return segments.length === 1 && /^[A-Za-z0-9_]{1,15}$/.test(segments[0]) ? segments[0] : null;
  } catch {
    return null;
  }
}

function imageUrls(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (item && typeof item === 'object') return [item.url, item.contentUrl].filter(Boolean);
    return [];
  }).filter((url) => typeof url === 'string' && /^https:\/\//.test(url));
}

function parseOgAuthor(title) {
  if (!title) return {};
  const match = title.match(/^(.*?)\s*\(@([A-Za-z0-9_]{1,15})\)\s+on X$/);
  return match ? { displayName: match[1].trim() || null, username: match[2] } : {};
}

export function parseXPostHtml(html, parsedUrl) {
  const $ = cheerio.load(html);
  const jsonLdCandidates = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      flattenJsonLd(JSON.parse($(script).text()), jsonLdCandidates);
    } catch {
      // A malformed JSON-LD block must not hide other valid public metadata.
    }
  });

  const socialCandidates = jsonLdCandidates.filter(isSocialMediaPosting);
  const jsonLdPost = socialCandidates.find((candidate) => {
    const identifiers = [candidate.url, candidate['@id'], candidate.mainEntityOfPage];
    return identifiers.some((identifier) => statusIdFromValue(identifier) === parsedUrl.postId);
  });

  const microdataPosts = $('[itemtype$="SocialMediaPosting"]');
  let microdataPost = null;
  microdataPosts.each((_, element) => {
    if (microdataPost) return;
    const candidate = $(element);
    const identifiers = [
      candidate.attr('itemid'),
      candidate.find('[itemprop="url"]').first().attr('content'),
      candidate.find('[itemprop="url"]').first().attr('href'),
    ];
    if (identifiers.some((identifier) => statusIdFromValue(identifier) === parsedUrl.postId)) {
      microdataPost = candidate;
    }
  });

  const og = (property) => $(`meta[property="${property}"]`).first().attr('content')?.trim() || null;
  const canonicalUrl = $('link[rel="canonical"]').first().attr('href') ?? og('og:url');
  const ogMatchesTarget = statusIdFromValue(canonicalUrl) === parsedUrl.postId
    || statusIdFromValue(og('og:url')) === parsedUrl.postId;

  if (!jsonLdPost && !microdataPost && !ogMatchesTarget) {
    const hasPostMetadata = socialCandidates.length > 0 || microdataPosts.length > 0 || og('og:url');
    throw new XCollectorError(
      hasPostMetadata ? 'POST_NOT_FOUND' : 'HTML_METADATA_NOT_FOUND',
      hasPostMetadata
        ? 'Public HTML metadata does not contain the target X post ID.'
        : 'No public X post metadata was found in the HTML.',
    );
  }

  const structuredAuthor = authorFromJsonLd(jsonLdPost?.author);
  const ogAuthor = parseOgAuthor(og('og:title'));
  const username = structuredAuthor.username ?? ogAuthor.username ?? parsedUrl.username;
  if (username.toLowerCase() !== parsedUrl.username.toLowerCase()) {
    throw new XCollectorError('EXTRACTION_FAILED', 'The public HTML author does not match the URL username.');
  }

  const microdataValue = (property) => microdataPost
    ? microdataPost.find(`[itemprop="${property}"]`).first().attr('content') ?? null
    : null;
  const text = [jsonLdPost?.articleBody, jsonLdPost?.text, microdataValue('articleBody'), og('og:description')]
    .find((value) => typeof value === 'string' && value.trim())?.trim() ?? null;
  const publishedAt = normalizeTimestamp(
    jsonLdPost?.datePublished ?? microdataValue('datePublished') ?? microdataValue('dateCreated'),
  );
  if (!text || !publishedAt) {
    throw new XCollectorError('EXTRACTION_FAILED', 'Required public HTML text or published timestamp is missing.');
  }

  const mediaUrls = [...new Set([
    ...imageUrls(jsonLdPost?.image),
    ...imageUrls(jsonLdPost?.associatedMedia),
  ])];

  return {
    displayName: structuredAuthor.displayName ?? ogAuthor.displayName ?? null,
    username,
    text,
    publishedAt,
    media: mediaUrls.map((url) => ({ type: 'image', url, alt: null })),
  };
}
