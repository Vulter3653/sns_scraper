import { collectYouTubeVideo } from '../collectors/youtube/collect-video.mjs';
import { YouTubeCollectorError } from '../collectors/youtube/errors.mjs';

const [url, ...extraArguments] = process.argv.slice(2);

if (!url || extraArguments.length > 0) {
  console.error(JSON.stringify({
    code: 'INVALID_YOUTUBE_URL',
    message: 'Usage: npm run collect:youtube -- "https://www.youtube.com/watch?v=<video_id>"',
  }));
  process.exitCode = 1;
} else {
  try {
    console.log(JSON.stringify(await collectYouTubeVideo(url), null, 2));
  } catch (error) {
    const failure = error instanceof YouTubeCollectorError
      ? error.toJSON()
      : { code: 'YOUTUBE_EXTRACTION_FAILED', message: 'Unexpected YouTube collector failure.' };
    console.error(JSON.stringify(failure));
    process.exitCode = 1;
  }
}
