import * as SecureStore from 'expo-secure-store';
import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import { env } from '../env';

// The app's better-auth client. It talks to the API's /api/auth/* handler (mounted in apps/api),
// stores the session cookie/token in the device keychain via SecureStore, and deep-links back using
// the app scheme. Passwordless: sign in by emailing a one-time code (the emailOTP plugin).
//
// baseURL is the API origin; better-auth appends its own /api/auth path. Keep this the ONLY auth
// client in the app (mirrors the single api-client instance for the public vinyl API).
export const authClient = createAuthClient({
  baseURL: env.EXPO_PUBLIC_API_BASE_URL,
  plugins: [
    expoClient({
      scheme: 'getvinyls',
      storagePrefix: 'getvinyls',
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
});
