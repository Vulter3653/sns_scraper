import { launchChromium } from '../../lib/browser.mjs';
import { fetchXPostHtml } from './fetch-post-html.mjs';
import { parseXPostHtml } from './parse-post-html.mjs';
import { XCollectorError } from './errors.mjs';

export { X_COLLECTOR_ERROR_CODES, XCollectorError } from './errors.mjs';

export function parseXPostUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new XCollectorError('INVALID_URL', 'An X post URL is required.');
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new XCollectorError('INVALID_URL', 'The supplied value is not a valid URL.');
  }

  const hostname = url.hostname.toLowerCase();
  const supportedHost = hostname === 'x.com' || hostname === 'twitter.com';
  const pathMatch = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)\/?$/);

  if (url.protocol !== 'https:' || !supportedHost || url.username || url.password || url.port || !pathMatch) {
    throw new XCollectorError(
      'UNSUPPORTED_URL',
      'Only public X or Twitter post URLs in /<username>/status/<post_id> form are supported.',
    );
  }

  const [, username, postId] = pathMatch;
  return {
    sourceUrl: input,
    canonicalUrl: `https://x.com/${username}/status/${postId}`,
    username,
    postId,
  };
}

export function parseMetricCount(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replaceAll(',', '').toUpperCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/);
  if (!match) return null;

  const multipliers = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
  const result = Number(match[1]) * (multipliers[match[2]] ?? 1);
  return Number.isSafeInteger(Math.round(result)) ? Math.round(result) : null;
}

export function createNormalizedXPost(parsedUrl, extracted, collectedAt = new Date().toISOString()) {
  return {
    schema_version: '1.0',
    platform: 'x',
    source_url: parsedUrl.sourceUrl,
    canonical_url: parsedUrl.canonicalUrl,
    post_id: parsedUrl.postId,
    author: {
      display_name: extracted.displayName ?? null,
      username: extracted.username ?? parsedUrl.username,
    },
    text: extracted.text,
    published_at: extracted.publishedAt,
    metrics: {
      reply_count: extracted.metrics?.replyCount ?? null,
      repost_count: extracted.metrics?.repostCount ?? null,
      like_count: extracted.metrics?.likeCount ?? null,
      bookmark_count: extracted.metrics?.bookmarkCount ?? null,
      view_count: extracted.metrics?.viewCount ?? null,
    },
    media: extracted.media ?? [],
    collected_at: collectedAt,
  };
}

function countFromLabel(label) {
  if (!label) return null;
  const match = label.replaceAll(',', '').match(/\d+(?:\.\d+)?\s*[KMB]?/i);
  return match ? parseMetricCount(match[0]) : null;
}

async function detectBlockedPage(page) {
  const url = page.url();
  if (/\/i\/flow\/login|\/login(?:\?|$)/i.test(url)) return true;

  const bodyText = await page.locator('body').innerText().catch(() => '');
  return /log in to x|sign in to x|something went wrong|rate limit exceeded/i.test(bodyText)
    && await page.locator('article[data-testid="tweet"]').count() === 0;
}

async function findTargetArticle(page, postId) {
  const articles = page.locator('article[data-testid="tweet"], article');
  await articles.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

  for (let index = 0; index < await articles.count(); index += 1) {
    const article = articles.nth(index);
    const matchingTimestamp = article.locator(`a[href*="/status/${postId}"] time`);
    if (await matchingTimestamp.count() > 0) return article;
  }

  return null;
}

async function extractArticle(article, parsedUrl) {
  const text = (await article.locator('[data-testid="tweetText"]').first().innerText().catch(() => '')).trim();
  const publishedAtValue = await article.locator('time').first().getAttribute('datetime').catch(() => null);
  const publishedAt = publishedAtValue && !Number.isNaN(Date.parse(publishedAtValue))
    ? new Date(publishedAtValue).toISOString()
    : null;

  const userNameArea = article.locator('[data-testid="User-Name"]').first();
  const userNameText = await userNameArea.innerText().catch(() => '');
  const usernameMatch = userNameText.match(/@([A-Za-z0-9_]{1,15})/);
  const username = usernameMatch?.[1] ?? parsedUrl.username;
  if (username.toLowerCase() !== parsedUrl.username.toLowerCase()) {
    throw new XCollectorError('EXTRACTION_FAILED', 'The rendered post author does not match the URL username.');
  }

  const displayName = userNameText
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith('@')) ?? null;

  const metric = async (testId) => countFromLabel(
    await article.locator(`[data-testid="${testId}"]`).first().getAttribute('aria-label').catch(() => null),
  );
  const viewCount = countFromLabel(
    await article.locator('a[href$="/analytics"]').first().getAttribute('aria-label').catch(() => null),
  );

  const media = await article.locator('[data-testid="tweetPhoto"] img').evaluateAll((images) => images.map((image) => ({
    type: 'image',
    url: image.currentSrc || image.src,
    alt: image.alt || null,
  })).filter(({ url }) => url));

  return {
    displayName,
    username,
    text,
    publishedAt,
    metrics: {
      replyCount: await metric('reply'),
      repostCount: await metric('retweet'),
      likeCount: await metric('like'),
      bookmarkCount: await metric('bookmark'),
      viewCount,
    },
    media,
  };
}

export async function collectXPostWithBrowser(parsedUrl, options = {}) {
  const browser = await (options.launchBrowser ?? launchChromium)();

  try {
    const page = await browser.newPage({ locale: 'en-US' });
    page.setDefaultTimeout(options.timeout ?? 15_000);
    page.setDefaultNavigationTimeout(options.navigationTimeout ?? 30_000);

    try {
      await page.goto(parsedUrl.canonicalUrl, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      throw new XCollectorError('NAVIGATION_FAILED', 'The X post page could not be loaded.', { cause: error });
    }

    const article = await findTargetArticle(page, parsedUrl.postId);
    if (!article) {
      if (await detectBlockedPage(page)) {
        throw new XCollectorError('LOGIN_OR_BLOCK_PAGE', 'X requires login or blocked public access to this post.');
      }
      throw new XCollectorError('POST_NOT_FOUND', 'Target X post could not be identified in the rendered page.');
    }

    const extracted = await extractArticle(article, parsedUrl);
    if (!extracted.text || !extracted.publishedAt) {
      throw new XCollectorError('EXTRACTION_FAILED', 'Required post text or machine-readable timestamp is missing.');
    }

    return createNormalizedXPost(parsedUrl, extracted);
  } finally {
    await browser.close();
  }
}

export async function collectXPost(input, options = {}) {
  const parsedUrl = parseXPostUrl(input);

  try {
    const response = await (options.fetchHtml ?? fetchXPostHtml)(parsedUrl.canonicalUrl, options.http);
    const extracted = (options.parseHtml ?? parseXPostHtml)(response.html, parsedUrl);
    return createNormalizedXPost(parsedUrl, extracted, options.collectedAt);
  } catch (error) {
    const canUseBrowserFallback = error instanceof XCollectorError
      && ['HTTP_FETCH_FAILED', 'HTML_METADATA_NOT_FOUND', 'POST_NOT_FOUND', 'EXTRACTION_FAILED'].includes(error.code)
      && options.browserFallback !== false;
    if (!canUseBrowserFallback) throw error;
  }

  return collectXPostWithBrowser(parsedUrl, options);
}
