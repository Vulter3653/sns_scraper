import { spawn } from 'node:child_process';
import { XAccountCollectorError } from '../account-errors.mjs';

const DEFAULT_TIMEOUT = 30_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export function buildTwitterCliArgs(username, limit) {
  return ['user-posts', username, '--max', String(limit), '--json'];
}

export function parseTwitterCliUserPosts(stdout, fallbackUsername) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new XAccountCollectorError(
      'ACCOUNT_DISCOVERY_FAILED',
      'twitter-cli did not return valid JSON user-posts output.',
    );
  }

  const entries = Array.isArray(payload)
    ? payload
    : payload?.ok === true && Array.isArray(payload.data) ? payload.data : null;
  if (!entries) {
    throw new XAccountCollectorError(
      'ACCOUNT_DISCOVERY_FAILED',
      'twitter-cli JSON did not contain a user-posts array.',
    );
  }

  const seenIds = new Set();
  const references = [];
  for (const entry of entries) {
    const postId = String(entry?.id ?? '');
    if (!/^\d+$/.test(postId) || seenIds.has(postId)) continue;
    const discoveredUsername = entry?.author?.screenName;
    const username = typeof discoveredUsername === 'string'
      && /^[A-Za-z0-9_]{1,15}$/.test(discoveredUsername)
      ? discoveredUsername
      : fallbackUsername;
    seenIds.add(postId);
    references.push({
      postId,
      username,
      url: `https://x.com/${username}/status/${postId}`,
    });
  }
  return references;
}

export function runTwitterCli({ command = 'twitter', args, env = process.env, timeout = DEFAULT_TIMEOUT }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    let outputBytes = 0;
    let settled = false;

    const fail = (code, message, cause) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new XAccountCollectorError(code, message, { cause }));
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      fail('TWITTER_CLI_FAILED', 'twitter-cli timed out while discovering account posts.');
    }, timeout);

    child.stdout.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill('SIGTERM');
        fail('TWITTER_CLI_FAILED', 'twitter-cli output exceeded the safety limit.');
      } else {
        stdout.push(chunk);
      }
    });
    child.stderr.on('data', () => {});
    child.on('error', (error) => {
      fail(
        error.code === 'ENOENT' ? 'TWITTER_CLI_NOT_AVAILABLE' : 'TWITTER_CLI_FAILED',
        error.code === 'ENOENT'
          ? 'twitter-cli is not installed or is not available on PATH.'
          : 'twitter-cli could not be started.',
        error,
      );
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new XAccountCollectorError('TWITTER_CLI_FAILED', `twitter-cli exited with code ${code}.`));
        return;
      }
      resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}

export async function discoverWithTwitterCli(username, limit, options = {}) {
  const env = options.env ?? process.env;
  const authToken = env.TWITTER_AUTH_TOKEN;
  const ct0 = env.TWITTER_CT0;
  if (!authToken || !ct0) {
    throw new XAccountCollectorError(
      'TWITTER_AUTH_REQUIRED',
      'twitter-cli account discovery requires TWITTER_AUTH_TOKEN and TWITTER_CT0.',
    );
  }

  const args = buildTwitterCliArgs(username, limit);
  const stdout = await (options.runner ?? runTwitterCli)({
    command: options.command ?? 'twitter',
    args,
    env,
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
  });
  return parseTwitterCliUserPosts(stdout, username).slice(0, limit);
}
