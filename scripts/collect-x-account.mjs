import { collectXAccount } from '../collectors/x/collect-account.mjs';
import { XAccountCollectorError } from '../collectors/x/account-errors.mjs';

const args = process.argv.slice(2);
const accountInput = args.shift();
let limit = 5;
let usageError = !accountInput;

while (args.length > 0 && !usageError) {
  const option = args.shift();
  if (option !== '--limit' || args.length === 0) {
    usageError = true;
    break;
  }
  limit = args.shift();
}

if (usageError) {
  console.error(JSON.stringify({
    code: 'INVALID_ACCOUNT',
    message: 'Usage: npm run collect:x-account -- "<account>" --limit <1-20>',
  }));
  process.exitCode = 1;
} else {
  try {
    console.log(JSON.stringify(await collectXAccount(accountInput, { limit }), null, 2));
  } catch (error) {
    const failure = error instanceof XAccountCollectorError
      ? error.toJSON()
      : { code: 'ACCOUNT_DISCOVERY_FAILED', message: 'Unexpected X account collection failure.' };
    console.error(JSON.stringify(failure));
    process.exitCode = 1;
  }
}
