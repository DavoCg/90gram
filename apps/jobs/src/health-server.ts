import { createServer, type Server } from 'node:http';
import type { Scheduler } from './scheduler.js';

// Minimal liveness/observability endpoint for the always-on scheduler machine. No web framework:
// the worker only needs a port the platform can health-check, plus a readable status payload. GET
// /health (or /) returns 200 with each job's schedule, next fire time, and last run result.
export function startHealthServer(port: number, scheduler: Scheduler): Server {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
      const body = JSON.stringify({ status: 'ok', jobs: scheduler.status() });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body);
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  server.listen(port, () => {
    console.log(`[jobs] health server listening on :${port} (GET /health)`);
  });

  return server;
}
