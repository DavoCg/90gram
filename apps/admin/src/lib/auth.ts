import './load-env';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, emailOTP } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { prisma } from '@getvinyls/db';
import { env } from './env';
import { sendEmail } from './email';

// The admin app's better-auth instance. It talks to the SAME Postgres tables (User/Session/Account/
// Verification) as apps/api through the Prisma adapter, with the SAME secret, so a session is valid
// across both. Sign-in is passwordless email OTP (identical config to apps/api). The `admin` plugin
// adds the role/ban columns (migrated in packages/db) and lets us gate the app on role === 'admin'.
// tanstackStartCookies() must come last: it wires better-auth's Set-Cookie handling into TanStack
// Start's request/response lifecycle.
export const auth = betterAuth({
  baseURL: env.ADMIN_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 5,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== 'sign-in') return;
        await sendEmail({
          to: email,
          subject: 'Your getvinyls admin sign-in code',
          text: `Your getvinyls admin sign-in code is ${otp}. It expires in 5 minutes.`,
        });
      },
    }),
    admin(),
    tanstackStartCookies(),
  ],
});
