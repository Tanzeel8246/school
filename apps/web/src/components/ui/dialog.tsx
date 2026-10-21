import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind width class for the centered panel. */
  className?: string;
}

/**
 * Lightweight controlled modal — no external dependency.
 * Closes on Esc and backdrop click; locks body scroll while open.
 */
export function Dialog({ open, onClose, children, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full bg-card text-card-foreground shadow-2xl rounded-t-2xl sm:rounded-xl sm:max-w-lg border border-border flex flex-col max-h-[90vh] animate-scale-in',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({
  title,
  description,
  onClose,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4 bg-card rounded-t-xl z-20">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4 overflow-y-auto flex-1 min-h-0', className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4 rounded-b-xl z-20',
        className,
      )}
      {...props}
    />
  );
}
