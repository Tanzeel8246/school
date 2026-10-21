import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RowMenuItem {
  label: string;
  onClick: () => void;
  /** Render in destructive (red) styling. */
  danger?: boolean;
  hidden?: boolean;
}

/** A small "…" dropdown of row actions. Closes on outside click / Esc. */
export function RowMenu({ items, trigger }: { items: RowMenuItem[]; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block text-left">
      {trigger ? (
        <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      ) : (
        <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label="Row actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      )}
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                'block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted',
                item.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
