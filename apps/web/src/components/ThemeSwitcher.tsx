import { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const THEMES = [
  { id: 'obsidian', label: 'Obsidian', color: 'bg-amber-500', dark: true },
  { id: 'arctic', label: 'Arctic', color: 'bg-sky-400', dark: false },
  { id: 'sunset', label: 'Sunset', color: 'bg-orange-500', dark: true },
  { id: 'forest', label: 'Forest', color: 'bg-emerald-500', dark: true },
  { id: 'lavender', label: 'Lavender', color: 'bg-violet-500', dark: false },
  { id: 'slate', label: 'Slate', color: 'bg-cyan-400', dark: true },
];

export function ThemeSwitcher() {
  const { user, updateTheme } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Map legacy theme IDs to new ones so existing users don't break
  const currentTheme = (() => {
    const t = user?.theme || 'obsidian';
    // Legacy themes all map to obsidian
    const legacy = ['emerald', 'warm-ivory', 'ocean', 'cyberpunk', 'sage', 'elite-gold', 'royal-copper', 'amethyst', 'monochrome', 'ruby'];
    return legacy.includes(t) ? 'obsidian' : t;
  })();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="rounded-full hover:bg-muted"
        title="Change Theme"
      >
        <Palette className="h-5 w-5 text-muted-foreground" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card p-3 shadow-xl z-50 animate-fade-in">
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Theme
          </p>
          <div className="space-y-1">
            {THEMES.map((theme) => {
              const isActive = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    updateTheme(theme.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                    'hover:bg-muted/80',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground/80'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      theme.color,
                    )}
                  >
                    {isActive && <Check className="h-3 w-3 text-white drop-shadow-sm" />}
                  </span>
                  <span>{theme.label}</span>
                  {theme.dark && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                      dark
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
