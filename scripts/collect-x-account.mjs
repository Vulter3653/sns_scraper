import { readFile } from 'node:fs/promises';
import { collectXAccount } from '../collectors/x/collect-account.mjs';
import { XAccountCollectorError } from '../collectors/x/account-errors.mjs';

const args = process.argv.slice(2);
const accountInput = args.shift();
let limit = 5;
let knownIdsPath = null;
let stopOnExisting = false;
let existingStopThreshold = 1;
let usageError = !accountInput;

while (args.length > 0 && !usageError) {
  const option = args.shift();
  if (option === '--limit' && args.length > 0) {
    limit = args.shift();
  } else if (option === '--known-ids' && args.length > 0) {
    knownIdsPath = args.shift();
  } else if (option === '--stop-on-existing' && args.length > 0) {
    stopOnExisting = true;
    existingStopThreshold = args.shift();
  } else {
    usageError = true;
  }
}

if (stopOnExisting && !knownIdsPath) usageError = true;

if (usageError) {
  console.error(JSON.stringify({
    code: 'INVALID_ACCOUNT_OPTIONS',
    message: 'Usage: npm run collect:x-account -- "<account>" --limit <1-20> [--known-ids <newline-id-file>] [--stop-on-existing <1-20>]',
  }));
  process.exitCode = 1;
} else {
  try {
    let knownPostIds = [];
    if (knownIdsPath) {
      try {
        knownPostIds = (await readFile(knownIdsPath, 'utf8'))
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
      } catch {
        throw new XAccountCollectorError(
          'INVALID_ACCOUNT_OPTIONS',
          'The known post ID file could not be read.',
        );
      }
    }

    console.log(JSON.stringify(await collectXAccount(accountInput, {
      limit,
      knownPostIds,
      stopOnExisting,
      existingStopThreshold,
    }), null, 2));
  } catch (error) {
    const failure = error instanceof XAccountCollectorError
      ? error.toJSON()
      : { code: 'ACCOUNT_DISCOVERY_FAILED', message: 'Unexpected X account collection failure.' };
    console.error(JSON.stringify(failure));
    process.exitCode = 1;
  }
}
