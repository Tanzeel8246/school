import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/dashboard" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </div>
  );
}
