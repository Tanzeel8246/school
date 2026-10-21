import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Fmt = 'pdf' | 'xlsx' | 'csv';

interface Props {
  type: string;
  params: Record<string, string | number | undefined>;
  onExport?: () => void;
}

const FMT_LABELS: { fmt: Fmt; label: string }[] = [
  { fmt: 'pdf', label: 'PDF' },
  { fmt: 'xlsx', label: 'Excel' },
  { fmt: 'csv', label: 'CSV' },
];

/**
 * Three export buttons (PDF | Excel | CSV).
 * Each triggers an authenticated file download via api.download.
 * Shows a per-button spinner while downloading and a toast on error.
 */
export function ExportBar({ type, params, onExport }: Props) {
  const [busy, setBusy] = useState<Fmt | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function handleExport(fmt: Fmt) {
    if (busy) return;
    setBusy(fmt);
    setToast(null);
    try {
      const qs = new URLSearchParams();
      qs.set('format', fmt);
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') qs.set(k, String(v));
      }
      await api.download(`/reports/${type}?${qs.toString()}`);
      onExport?.();
    } catch {
      setToast(`Export failed. Please try again.`);
      // Auto-clear toast after 4 s.
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <FileDown className="h-3.5 w-3.5" />
          Export
        </span>
        {FMT_LABELS.map(({ fmt, label }) => (
          <Button
            key={fmt}
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => handleExport(fmt)}
            className="h-8 px-3 text-xs"
          >
            {busy === fmt ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {label}
          </Button>
        ))}
      </div>
      {toast && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {toast}
        </p>
      )}
    </div>
  );
}
