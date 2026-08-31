import { collectXPost } from './collect-post.mjs';
import { XAccountCollectorError } from './account-errors.mjs';
import { discoverWithTwitterCli } from './backends/twitter-cli.mjs';

const RESERVED_PATHS = new Set(['home', 'explore', 'messages', 'search', 'settings', 'i', 'status']);

export function parseXAccount(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new XAccountCollectorError('INVALID_ACCOUNT', 'An X username or account URL is required.');
  }

  let username;
  const value = input.trim();
  if (value.startsWith('@')) {
    username = value.slice(1);
  } else if (/^https?:\/\//i.test(value)) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new XAccountCollectorError('INVALID_ACCOUNT', 'The X account URL is invalid.');
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const supportedHost = ['x.com', 'twitter.com'].includes(url.hostname.toLowerCase());
    if (
      url.protocol !== 'https:'
      || !supportedHost
      || url.username
      || url.password
      || url.port
      || segments.length !== 1
      || url.search
      || url.hash
    ) {
      throw new XAccountCollectorError('INVALID_ACCOUNT', 'Only a public X account root URL is supported.');
    }
    [username] = segments;
  } else {
    username = value;
  }

  if (!/^[A-Za-z0-9_]{1,15}$/.test(username) || RESERVED_PATHS.has(username.toLowerCase())) {
    throw new XAccountCollectorError('INVALID_ACCOUNT', 'The supplied X username is not supported.');
  }
  return {
    username,
    canonicalUrl: `https://x.com/${username}`,
  };
}

export function validateAccountLimit(value = 5) {
  const limit = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new XAccountCollectorError('INVALID_ACCOUNT', 'Account collection limit must be an integer from 1 to 20.');
  }
  return limit;
}

export function normalizeKnownPostIds(value = []) {
  if (value == null) return new Set();
  if (!Array.isArray(value) && !(value instanceof Set)) {
    throw new XAccountCollectorError(
      'INVALID_ACCOUNT_OPTIONS',
      'knownPostIds must be an array or Set of numeric X post IDs.',
    );
  }

  const ids = new Set();
  for (const rawId of value) {
    const postId = String(rawId ?? '').trim();
    if (!/^\d+$/.test(postId)) {
      throw new XAccountCollectorError(
        'INVALID_ACCOUNT_OPTIONS',
        'knownPostIds may contain only numeric X post IDs.',
      );
    }
    ids.add(postId);
  }
  return ids;
}

export function validateExistingStopThreshold(value = 1) {
  const threshold = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 20) {
    throw new XAccountCollectorError(
      'INVALID_ACCOUNT_OPTIONS',
      'Existing-post stop threshold must be an integer from 1 to 20.',
    );
  }
  return threshold;
}

export async function collectXAccount(input, options = {}) {
  const account = parseXAccount(input);
  const limit = validateAccountLimit(options.limit);
  const knownPostIds = normalizeKnownPostIds(options.knownPostIds);
  const stopOnExisting = options.stopOnExisting === true;
  const existingStopThreshold = validateExistingStopThreshold(options.existingStopThreshold ?? 1);
  const discover = options.discover ?? discoverWithTwitterCli;
  const hydrate = options.collectPost ?? collectXPost;
  const references = await discover(account.username, limit, options.twitterCli);
  if (!Array.isArray(references)) {
    throw new XAccountCollectorError('ACCOUNT_DISCOVERY_FAILED', 'The account backend returned an invalid result.');
  }

  const posts = [];
  const failures = [];
  let examinedCount = 0;
  let knownPostsSeen = 0;
  let consecutiveExistingSeen = 0;
  let stoppedOnExisting = false;
  let stopReason = references.length === 0 ? 'no_references_discovered' : 'references_exhausted';

  for (const reference of references.slice(0, limit)) {
    examinedCount += 1;
    const postId = String(reference?.postId ?? '');
    if (postId && knownPostIds.has(postId)) {
      knownPostsSeen += 1;
      consecutiveExistingSeen += 1;
      if (stopOnExisting && consecutiveExistingSeen >= existingStopThreshold) {
        stoppedOnExisting = true;
        stopReason = 'existing_threshold_reached';
        break;
      }
      continue;
    }

    consecutiveExistingSeen = 0;
    try {
      posts.push(await hydrate(reference.url));
    } catch (error) {
      failures.push({
        url: reference.url,
        code: typeof error?.code === 'string' ? error.code : 'EXTRACTION_FAILED',
        message: typeof error?.message === 'string' ? error.message : 'Unexpected post hydration failure.',
      });
    }
  }

  return {
    schema_version: '1.0',
    platform: 'x',
    collection_type: 'account',
    source_url: account.canonicalUrl,
    canonical_url: account.canonicalUrl,
    account: { display_name: null, username: account.username },
    discovered_count: references.length,
    collected_count: posts.length,
    failed_count: failures.length,
    posts,
    failures,
    collection_state: {
      known_id_count: knownPostIds.size,
      examined_count: examinedCount,
      known_posts_seen: knownPostsSeen,
      consecutive_existing_seen: consecutiveExistingSeen,
      stopped_on_existing: stoppedOnExisting,
      stop_reason: stopReason,
    },
    collected_at: options.collectedAt ?? new Date().toISOString(),
  };
}
