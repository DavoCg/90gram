import { createFileRoute } from '@tanstack/react-router';

// Liveness endpoint for the Fly health check (GET /api/health -> 200 {status:"ok"}).
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => Response.json({ status: 'ok' }),
    },
  },
});
