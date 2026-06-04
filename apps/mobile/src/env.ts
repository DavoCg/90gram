import { z } from 'zod';

// Typed env for the app. EXPO_PUBLIC_ vars are inlined into the bundle at build time.
// Use a LAN IP (not 127.0.0.1) so a physical device can reach the API.
const EnvSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z.url().default('http://127.0.0.1:8787'),
});

export const env = EnvSchema.parse({
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
});
