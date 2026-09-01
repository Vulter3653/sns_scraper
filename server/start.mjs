import { createApiServer } from './x-post-api.mjs';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? 8787);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error('API_PORT must be an integer from 1 to 65535.');
  process.exitCode = 1;
} else {
  const server = createApiServer();
  server.listen(port, host, () => {
    console.log(`SNS Scope API listening on http://${host}:${port}`);
  });
}
