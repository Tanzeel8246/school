import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

/** Extract a human-readable message from an unknown thrown error. */
function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const payload = err.payload as { message?: string } | undefined;
    return payload?.message ?? (err.status === 401 ? 'Invalid email or password.' : 'Login failed.');
  }
  return 'Something went wrong. Please try again.';
}

export function LoginPage() {
  const { login, pendingChallenge } = useAuth();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Tracks whether a login attempt completed without throwing, so the effect
  // below can inspect the resulting auth state once React has re-rendered.
  const [loginSettled, setLoginSettled] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoginSettled(false);
    setLoading(true);
    try {
      await login(loginId, password);
      // Signal that the login call resolved (auth state has been updated).
      setLoginSettled(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // After login() resolves, read the *updated* auth state from context and
  // navigate accordingly. We use an effect so we're reading post-render values,
  // not stale closure values.
  useEffect(() => {
    if (!loginSettled) return;
    setLoginSettled(false); // consume the signal
    if (pendingChallenge) {
      navigate('/2fa/challenge', { replace: true });
    } else {
      // Normal login — user state has been set, go to dashboard.
      navigate('/dashboard', { replace: true });
    }
  }, [loginSettled, pendingChallenge, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
            <GraduationCap className="h-6 w-6" />
          </span>
          <CardTitle>Welcome back</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your school account</p>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="loginId">Email or Username</Label>
              <Input
                id="loginId"
                type="text"
                autoComplete="username"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="you@school.edu or username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Demo: <span className="font-medium text-foreground">principal@demo.edu</span> /{' '}
              <span className="font-medium text-foreground">Passw0rd!</span>
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              No account?{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Create your school
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
