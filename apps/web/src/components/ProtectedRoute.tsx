import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Guards the authenticated area. While the initial silent refresh runs we show a
 * loader (prevents a flash of /login). Once settled, redirect anonymous users.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
