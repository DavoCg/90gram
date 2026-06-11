import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/lib/auth';

// Mounts better-auth's handler at /api/auth/* (sign-in, OTP verify, session, sign-out). The browser
// auth client (lib/auth-client.ts) talks to these routes.
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
