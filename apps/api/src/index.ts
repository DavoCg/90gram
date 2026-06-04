import './load-env.js';
import { serve } from '@hono/node-server';
import { env } from './env.js';
import { createApp } from './app.js';

const app = createApp();

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`getvinyls API listening on http://127.0.0.1:${info.port}`);
  console.log(`  OpenAPI:  http://127.0.0.1:${info.port}/openapi.json`);
  console.log(`  Docs:     http://127.0.0.1:${info.port}/docs`);
});
