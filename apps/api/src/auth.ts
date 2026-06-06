import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { prisma } from '@getvinyls/db';
import { env } from './env.js';
import { sendEmail } from './email.js';

// The single better-auth instance for the app. Passwordless: users sign in with a one-time code
// emailed to them (no passwords, no social providers). It reads/writes the User/Session/Account/
// Verification tables through the Prisma adapter (schema owned by packages/db). The Hono handler
// is mounted at /api/auth/* in app.ts; the Expo client talks to it from apps/mobile.
//
// trustedOrigins must include the mobile deep-link scheme (and the Expo Go dev origins) so the
// expo plugin accepts requests coming from the native app rather than a browser origin.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  trustedOrigins: [
    `${env.APP_SCHEME}://`,
    ...(env.NODE_ENV === 'production'
      ? []
      : ['exp://', 'exp://**', 'exp://192.168.*.*:*/**', 'exp://10.*.*.*:*/**']),
  ],
  plugins: [
    expo(),
    emailOTP({
      // 6-digit code, valid for 5 minutes. On mobile, code entry is more robust than deep-link
      // magic links (no universal-link plumbing), so this is the primary sign-in method.
      otpLength: 6,
      expiresIn: 60 * 5,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== 'sign-in') return;
        await sendEmail({
          to: email,
          subject: 'Your getvinyls sign-in code',
          text: `Your getvinyls sign-in code is ${otp}. It expires in 5 minutes.`,
        });
      },
    }),
  ],
});
