import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { recordsRouter } from './routes/records.js';

// The OpenAPI document is GENERATED from the registered Zod routes, never authored by hand.
export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.get('/', (c) => c.json({ name: 'getvinyls-api', status: 'ok' }));
  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.route('/', recordsRouter);

  // OpenAPI 3.1 JSON. This is the contract consumed by `pnpm gen:api-types`.
  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'getvinyls API',
      version: '0.1.0',
      description: 'Read-only public API for vinyl record discovery.',
    },
  });

  // Docs UI.
  app.get('/docs', Scalar({ url: '/openapi.json', pageTitle: 'getvinyls API' }));

  return app;
}
