import { createAuthClient } from 'better-auth/react';
import { adminClient, emailOTPClient } from 'better-auth/client/plugins';

// Browser auth client used by the login UI and the sign-out button. baseURL is omitted so it targets
// the same origin the app is served from (/api/auth/*). Plugins must mirror the server instance.
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), adminClient()],
});
