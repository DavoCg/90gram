import { createApiClient } from '@getvinyls/api-client';
import { env } from '../env';
import { authClient } from '../auth/client';

// One typed client for the whole app, built from the generated openapi-fetch factory. The public
// vinyl routes are unauthenticated, but we forward the better-auth session cookie (read from the
// device keychain) so per-user endpoints (favorites) are authenticated. This stays a typed
// openapi-fetch client (no hand-written fetch); we only decorate the request with the cookie.
//
// openapi-fetch builds a Request and calls this as fetch(request) with NO init, so the request's
// own headers (Content-Type on a POST body, Accept, ...) live on `input.headers`. We must ADD the
// cookie onto those existing headers; passing a fresh init/headers object instead would REPLACE
// them and drop Content-Type, so the server could not parse the JSON body and writes would fail.
export const apiClient = createApiClient({
  baseUrl: env.EXPO_PUBLIC_API_BASE_URL,
  fetch: (input, init) => {
    const cookie = authClient.getCookie();
    if (!cookie) return fetch(input, init);
    if (input instanceof Request) {
      input.headers.set('Cookie', cookie);
      return fetch(input);
    }
    const headers = new Headers(init?.headers);
    headers.set('Cookie', cookie);
    return fetch(input, { ...init, headers });
  },
});
