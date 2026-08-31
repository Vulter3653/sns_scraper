export const X_ACCOUNT_ERROR_CODES = Object.freeze({
  INVALID_ACCOUNT: 'INVALID_ACCOUNT',
  TWITTER_CLI_NOT_AVAILABLE: 'TWITTER_CLI_NOT_AVAILABLE',
  TWITTER_AUTH_REQUIRED: 'TWITTER_AUTH_REQUIRED',
  TWITTER_CLI_FAILED: 'TWITTER_CLI_FAILED',
  ACCOUNT_DISCOVERY_FAILED: 'ACCOUNT_DISCOVERY_FAILED',
});

export class XAccountCollectorError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'XAccountCollectorError';
    this.code = code;
  }

  toJSON() {
    return { code: this.code, message: this.message };
  }
}
