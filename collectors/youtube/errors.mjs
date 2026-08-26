export const YOUTUBE_ERROR_CODES = Object.freeze({
  INVALID_YOUTUBE_URL: 'INVALID_YOUTUBE_URL',
  UNSUPPORTED_YOUTUBE_URL: 'UNSUPPORTED_YOUTUBE_URL',
  YTDLP_NOT_AVAILABLE: 'YTDLP_NOT_AVAILABLE',
  YTDLP_TIMEOUT: 'YTDLP_TIMEOUT',
  YTDLP_FAILED: 'YTDLP_FAILED',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  VIDEO_UNAVAILABLE: 'VIDEO_UNAVAILABLE',
  VIDEO_ID_MISMATCH: 'VIDEO_ID_MISMATCH',
  YOUTUBE_EXTRACTION_FAILED: 'YOUTUBE_EXTRACTION_FAILED',
});

export class YouTubeCollectorError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'YouTubeCollectorError';
    this.code = code;
  }

  toJSON() {
    return { code: this.code, message: this.message };
  }
}
