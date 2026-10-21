import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const payload = err.payload as { message?: string } | undefined;
    return payload?.message ?? 'Verification failed. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

/** Make an authenticated fetch using an explicit bearer token (bypasses the
 *  module-level in-memory token so we can use the challengeToken here). */
async function authFetch<T>(
  path: string,
  bearerToken: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<{ data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${bearerToken}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? json);
  }
  return json as { data: T };
}

export function TwoFaChallengePage() {
  const { pendingChallenge, clearPending, setUser, applyToken } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  // Redirect if no pending challenge
  useEffect(() => {
    if (!pendingChallenge) {
      navigate('/login', { replace: true });
    }
  }, [pendingChallenge, navigate]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!pendingChallenge) return null;

  const { challengeToken } = pendingChallenge;

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const { data } = await authFetch<{ accessToken: string; user: { id: string; name: string; role: string; schoolId?: string } }>(
        '/auth/2fa/verify',
        challengeToken,
        'POST',
        { code },
      );
      applyToken(data.accessToken);
      setUser(data.user);
      clearPending();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onResendEmail() {
    setSending(true);
    setError(null);
    setSentMessage(null);
    try {
      await authFetch<{ sent: boolean }>('/auth/2fa/send-email-otp', challengeToken, 'POST');
      setSentMessage('A new verification code has been sent to your email.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
            <Mail className="h-6 w-6" />
          </span>
          <CardTitle>Email Verification Required</CardTitle>
          <p className="text-sm text-muted-foreground">A verification code has been sent to your email</p>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          
          {sentMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {sentMessage}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="email-code">
                6-digit code
              </label>
              <Input
                id="email-code"
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-lg tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onResendEmail}
                disabled={sending || loading}
              >
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resend Email
              </Button>
              <Button type="submit" className="flex-1" disabled={loading || code.length !== 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
