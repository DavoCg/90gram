import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ error: z.string().optional() }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Could not send the code.');
      return;
    }
    setStep('otp');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await authClient.signIn.emailOtp({ email, otp });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Invalid or expired code.');
      return;
    }
    await navigate({ to: '/' });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>getvinyls admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {search.error === 'forbidden' && (
            <p className="text-sm text-destructive">
              That account is not an admin. Sign in with an authorized account.
            </p>
          )}

          {step === 'email' ? (
            <form onSubmit={sendCode} className="space-y-3">
              <Input
                type="email"
                placeholder="you@getvinyls.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={pending || !email}>
                {pending ? 'Sending...' : 'Send sign-in code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to {email}.
              </p>
              <Input
                inputMode="numeric"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={pending || otp.length < 6}>
                {pending ? 'Verifying...' : 'Verify and sign in'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError(null);
                }}
              >
                Use a different email
              </Button>
            </form>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
