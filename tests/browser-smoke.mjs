import { launchChromium } from '../lib/browser.mjs';

let browser;

try {
  browser = await launchChromium();
  const page = await browser.newPage();

  await page.goto(
    'data:text/html,<title>Playwright Smoke Test</title><main id="status">ready</main>',
  );

  const title = await page.title();
  const status = await page.locator('#status').textContent();

  if (title !== 'Playwright Smoke Test' || status !== 'ready') {
    throw new Error(`Unexpected page state: title=${title}, status=${status}`);
  }

  console.log('Browser smoke test passed');
} finally {
  await browser?.close();
}
