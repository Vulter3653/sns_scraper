import { collectXPost, XCollectorError } from '../collectors/x/collect-post.mjs';

const [url, ...extraArguments] = process.argv.slice(2);

if (!url || extraArguments.length > 0) {
  console.error(JSON.stringify({
    code: 'INVALID_URL',
    message: 'Usage: npm run collect:x -- "https://x.com/<username>/status/<post_id>"',
  }));
  process.exitCode = 1;
} else {
  try {
    const result = await collectXPost(url);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const failure = error instanceof XCollectorError
      ? error.toJSON()
      : { code: 'EXTRACTION_FAILED', message: 'Unexpected X collector failure.' };
    console.error(JSON.stringify(failure));
    process.exitCode = 1;
  }
}
