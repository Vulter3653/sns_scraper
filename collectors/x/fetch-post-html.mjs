import { fetch, ProxyAgent } from 'undici';
import { XCollectorError } from './errors.mjs';

const ALLOWED_HOSTS = new Set(['x.com', 'twitter.com']);
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

function assertAllowedUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new XCollectorError('UNSUPPORTED_URL', 'HTTP retrieval requires a valid X post URL.');
  }

  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new XCollectorError('UNSUPPORTED_URL', 'HTTP retrieval is restricted to HTTPS X and Twitter URLs.');
  }
  return url;
}

async function readLimitedText(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new XCollectorError('HTTP_FETCH_FAILED', `X HTML exceeds the ${maxBytes}-byte response limit.`);
  }

  const chunks = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new XCollectorError('HTTP_FETCH_FAILED', `X HTML exceeds the ${maxBytes}-byte response limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchXPostHtml(url, options = {}) {
  let currentUrl = assertAllowedUrl(url);
  const proxyUrl = options.proxyUrl
    ?? process.env.HTTPS_PROXY
    ?? process.env.https_proxy
    ?? process.env.HTTP_PROXY
    ?? process.env.http_proxy;
  const dispatcher = options.dispatcher ?? (proxyUrl ? new ProxyAgent(proxyUrl) : undefined);
  const ownsDispatcher = dispatcher && dispatcher !== options.dispatcher;
  const request = options.fetchImpl ?? fetch;

  try {
    for (let redirects = 0; redirects <= (options.maxRedirects ?? DEFAULT_MAX_REDIRECTS); redirects += 1) {
      let response;
      try {
        response = await request(currentUrl, {
          dispatcher,
          redirect: 'manual',
          signal: AbortSignal.timeout(options.timeout ?? 20_000),
          headers: { accept: 'text/html,application/xhtml+xml' },
        });
      } catch (error) {
        throw new XCollectorError('HTTP_FETCH_FAILED', 'The public X HTML request failed.', { cause: error });
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new XCollectorError('HTTP_FETCH_FAILED', 'X returned a redirect without a location.');
        }
        currentUrl = assertAllowedUrl(new URL(location, currentUrl).href);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new XCollectorError('HTTP_BLOCKED', `X public HTML request was blocked with HTTP ${response.status}.`);
      }
      if (!response.ok) {
        throw new XCollectorError('HTTP_FETCH_FAILED', `X public HTML request failed with HTTP ${response.status}.`);
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new XCollectorError('HTTP_FETCH_FAILED', `Expected HTML but received ${contentType || 'an unknown content type'}.`);
      }

      return {
        html: await readLimitedText(response, options.maxBytes ?? DEFAULT_MAX_BYTES),
        status: response.status,
        contentType,
        finalUrl: currentUrl.href,
      };
    }
    throw new XCollectorError('HTTP_FETCH_FAILED', 'X returned too many redirects.');
  } finally {
    if (ownsDispatcher) await dispatcher.close();
  }
}
