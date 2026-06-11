import { env } from './env';

// Minimal transactional email sender via Resend's HTTP API. Mirrors apps/api/src/email.ts (apps
// cannot import each other, so this is a small, intentional duplication). When RESEND_API_KEY is
// unset (local dev), the message is logged to the console instead of sent, so the OTP sign-in flow
// is usable without a provider.
export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.info(`[email:dev] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}
