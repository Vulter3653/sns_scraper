import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolveBrowserExecutable() {
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  const metadataPath = path.join(
    path.dirname(fileURLToPath(import.meta.resolve('playwright-core'))),
    'browsers.json',
  );
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const browserVersion = metadata.browsers.find(({ name }) => name === 'chromium')?.browserVersion;
  const fallbackExecutable = path.join(
    projectRoot,
    '.cache',
    'chrome-for-testing',
    browserVersion ?? '',
    'chrome-linux64',
    'chrome',
  );

  return fs.existsSync(fallbackExecutable) ? fallbackExecutable : undefined;
}

export function launchChromium(options = {}) {
  return chromium.launch({
    headless: true,
    executablePath: resolveBrowserExecutable(),
    ...options,
  });
}
