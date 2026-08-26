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

export async function collectXAccount(input, options = {}) {
  const account = parseXAccount(input);
  const limit = validateAccountLimit(options.limit);
  const discover = options.discover ?? discoverWithTwitterCli;
  const hydrate = options.collectPost ?? collectXPost;
  const references = await discover(account.username, limit, options.twitterCli);
  if (!Array.isArray(references)) {
    throw new XAccountCollectorError('ACCOUNT_DISCOVERY_FAILED', 'The account backend returned an invalid result.');
  }

  const posts = [];
  const failures = [];
  for (const reference of references.slice(0, limit)) {
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
    collected_at: options.collectedAt ?? new Date().toISOString(),
  };
}
