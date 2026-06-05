import { env } from './env.js';

// Minimal transactional email sender. We hit the Resend HTTP API directly (no SDK dependency) when
// RESEND_API_KEY is configured; otherwise we log to the server console so the email-OTP flow is
// fully usable in local development without a mail provider. Never throw from here: a failed send
// must not leak whether an email exists, and the OTP route should not 500 on mail issues.

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail({ to, subject, text }: SendEmailInput): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // Dev fallback: surface the message (and any OTP it contains) in the API logs.
    console.log(`[email:dev] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.RESEND_FROM, to, subject, text }),
    });
    if (!res.ok) {
      console.error(`[email] Resend responded ${res.status}: ${await res.text()}`);
    }
  } catch (error) {
    console.error('[email] failed to send', error);
  }
}
