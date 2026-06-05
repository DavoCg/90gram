import { createApiClient } from '@getvinyls/api-client';
import { env } from '../env';
import { authClient } from '../auth/client';

// One typed client for the whole app, built from the generated openapi-fetch factory. The public
// vinyl routes are unauthenticated, but we forward the better-auth session cookie (read from the
// device keychain) so any future per-user endpoints are authenticated automatically. This stays a
// typed openapi-fetch client (no hand-written fetch); we only decorate the request with the cookie.
export const apiClient = createApiClient({
  baseUrl: env.EXPO_PUBLIC_API_BASE_URL,
  fetch: (input, init) => {
    const cookie = authClient.getCookie();
    const headers = new Headers(init?.headers);
    if (cookie) headers.set('Cookie', cookie);
    return fetch(input, { ...init, headers });
  },
});
