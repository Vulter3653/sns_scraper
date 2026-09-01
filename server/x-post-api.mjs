import http from 'node:http';
import { collectXPost, parseXPostUrl, XCollectorError } from '../collectors/x/collect-post.mjs';

const MAX_BODY_BYTES = 16 * 1024;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readJsonBody(request) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new XCollectorError('INVALID_REQUEST', 'Content-Type must be application/json.');
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new XCollectorError('INVALID_REQUEST', 'Request body exceeds the 16 KiB limit.');
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new XCollectorError('INVALID_REQUEST', 'Request body must contain valid JSON.');
  }
}

function statusForCollectorError(error) {
  if (error.code === 'INVALID_REQUEST' || error.code === 'INVALID_URL') return 400;
  if (error.code === 'UNSUPPORTED_URL') return 422;
  if (error.code === 'POST_NOT_FOUND') return 404;
  return 502;
}

export function createApiServer(options = {}) {
  const collectPost = options.collectPost ?? collectXPost;

  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    if (request.method !== 'POST' || requestUrl.pathname !== '/api/x/post') {
      sendJson(response, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'API route not found.' } });
      return;
    }

    try {
      const body = await readJsonBody(request);
      const isPlainObject = body && typeof body === 'object' && !Array.isArray(body);
      if (!isPlainObject || Object.keys(body).length !== 1 || typeof body.url !== 'string') {
        throw new XCollectorError('INVALID_REQUEST', 'Request body must contain only a string url field.');
      }

      parseXPostUrl(body.url);
      const data = await collectPost(body.url);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      if (error instanceof XCollectorError) {
        sendJson(response, statusForCollectorError(error), { ok: false, error: error.toJSON() });
        return;
      }
      sendJson(response, 500, {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' },
      });
    }
  });
}
