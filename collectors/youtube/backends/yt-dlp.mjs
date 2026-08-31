import { spawn } from 'node:child_process';
import { YouTubeCollectorError } from '../errors.mjs';

const DEFAULT_TIMEOUT = 30_000;
const MAX_STDOUT_BYTES = 5 * 1024 * 1024;
const MAX_STDERR_BYTES = 256 * 1024;

export function buildYtDlpArgs(url) {
  return [
    '--dump-single-json',
    '--skip-download',
    '--no-playlist',
    '--js-runtimes',
    'node',
    url,
  ];
}

function classifyYtDlpFailure(stderr) {
  if (/private video|members-only|sign in to confirm|login required|age.?restricted|not available in your country|geo.?restricted/i.test(stderr)) {
    return new YouTubeCollectorError('VIDEO_UNAVAILABLE', 'The YouTube video is not publicly available without authentication.');
  }
  if (/video unavailable|has been removed|deleted video|does not exist/i.test(stderr)) {
    return new YouTubeCollectorError('VIDEO_NOT_FOUND', 'The YouTube video was not found or has been removed.');
  }
  return new YouTubeCollectorError('YTDLP_FAILED', 'yt-dlp could not extract public YouTube video metadata.');
}

export function runYtDlp({ command = 'yt-dlp', args, env = process.env, timeout = DEFAULT_TIMEOUT }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      fail(new YouTubeCollectorError('YTDLP_TIMEOUT', 'yt-dlp timed out while extracting video metadata.'));
    }, timeout);

    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        child.kill('SIGTERM');
        fail(new YouTubeCollectorError('YTDLP_FAILED', 'yt-dlp JSON output exceeded the safety limit.'));
      } else {
        stdout.push(chunk);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= MAX_STDERR_BYTES) stderr.push(chunk);
    });
    child.on('error', (error) => {
      fail(new YouTubeCollectorError(
        error.code === 'ENOENT' ? 'YTDLP_NOT_AVAILABLE' : 'YTDLP_FAILED',
        error.code === 'ENOENT' ? 'yt-dlp is not installed or is not available on PATH.' : 'yt-dlp could not be started.',
        { cause: error },
      ));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(classifyYtDlpFailure(Buffer.concat(stderr).toString('utf8')));
        return;
      }
      resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}

export async function extractWithYtDlp(url, options = {}) {
  const stdout = await (options.runner ?? runYtDlp)({
    command: options.command ?? 'yt-dlp',
    args: buildYtDlpArgs(url),
    env: options.env ?? process.env,
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
  });
  try {
    const metadata = JSON.parse(stdout);
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('not an object');
    return metadata;
  } catch (error) {
    throw new YouTubeCollectorError('YOUTUBE_EXTRACTION_FAILED', 'yt-dlp did not return valid single-video JSON.', { cause: error });
  }
}
