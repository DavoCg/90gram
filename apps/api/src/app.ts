import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { auth } from './auth.js';
import { vinylsRouter } from './routes/vinyls.js';
import { favoritesRouter } from './routes/favorites.js';

// The OpenAPI document is GENERATED from the registered Zod routes, never authored by hand.
export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.get('/', (c) => c.json({ name: 'getvinyls-api', status: 'ok' }));
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Authentication (better-auth). Its handler owns every /api/auth/* route (sign-in, OTP, session).
  // These are intentionally NOT part of the generated OpenAPI spec: the mobile app calls them
  // through better-auth's own typed client, not the generated openapi-fetch client. CORS with
  // credentials is needed for browser-origin callers; the native app is allowed via trustedOrigins.
  app.use(
    '/api/auth/*',
    cors({
      origin: (origin) => origin,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    }),
  );
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  app.route('/', vinylsRouter);
  app.route('/', favoritesRouter);

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
