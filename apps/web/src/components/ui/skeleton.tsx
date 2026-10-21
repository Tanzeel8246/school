import { cn } from '@/lib/utils';

/** Animated loading placeholder. Drop-in for any block element. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200', className)} />;
}
