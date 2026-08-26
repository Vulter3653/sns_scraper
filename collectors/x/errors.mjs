export const X_COLLECTOR_ERROR_CODES = Object.freeze({
  INVALID_URL: 'INVALID_URL',
  UNSUPPORTED_URL: 'UNSUPPORTED_URL',
  HTTP_FETCH_FAILED: 'HTTP_FETCH_FAILED',
  HTTP_BLOCKED: 'HTTP_BLOCKED',
  HTML_METADATA_NOT_FOUND: 'HTML_METADATA_NOT_FOUND',
  NAVIGATION_FAILED: 'NAVIGATION_FAILED',
  LOGIN_OR_BLOCK_PAGE: 'LOGIN_OR_BLOCK_PAGE',
  POST_NOT_FOUND: 'POST_NOT_FOUND',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
});

export class XCollectorError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'XCollectorError';
    this.code = code;
  }

  toJSON() {
    return { code: this.code, message: this.message };
  }
}
