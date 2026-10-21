import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { date } from '@/lib/format';
import type { Student, StudentHistory } from '@/lib/dto';

export type LifecycleAction = 'promote' | 'transfer' | 'suspend' | 'reinstate' | 'delete';

const CONFIG: Record<
  LifecycleAction,
  { title: string; confirm: string; variant?: 'destructive' }
> = {
  promote: { title: 'Promote student', confirm: 'Promote' },
  transfer: { title: 'Transfer student', confirm: 'Transfer' },
  suspend: { title: 'Suspend student', confirm: 'Suspend', variant: 'destructive' },
  reinstate: { title: 'Reinstate student', confirm: 'Reinstate' },
  delete: { title: 'Delete student', confirm: 'Delete', variant: 'destructive' },
};

interface ActionProps {
  open: boolean;
  action: LifecycleAction;
  student: Student;
  onClose: () => void;
  onDone: () => void;
}

/** Confirmation / input dialog for a single student lifecycle action. */
export function StudentActionDialog({ open, action, student, onClose, onDone }: ActionProps) {
  const [sectionId, setSectionId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSectionId('');
      setReason('');
      setError(null);
    }
  }, [open, action]);

  const cfg = CONFIG[action];

  async function run() {
    setBusy(true);
    setError(null);
    try {
      switch (action) {
        case 'promote':
          await api.post(`/students/${student.id}/promote`, { sectionId });
          break;
        case 'transfer':
          await api.post(`/students/${student.id}/transfer`, { reason: reason || undefined });
          break;
        case 'suspend':
          await api.post(`/students/${student.id}/suspend`, { reason: reason || undefined });
          break;
        case 'reinstate':
          await api.post(`/students/${student.id}/reinstate`, {});
          break;
        case 'delete':
          await api.del(`/students/${student.id}`);
          break;
      }
      onDone();
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? ((err.payload as { message?: string })?.message ?? 'Action failed.')
          : 'Action failed.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={cfg.title} description={student.fullName} onClose={onClose} />
      <DialogBody className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {action === 'promote' && (
          <div className="space-y-1.5">
            <Label htmlFor="sectionId">New section ID</Label>
            <Input
              id="sectionId"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              placeholder="section-uuid"
            />
          </div>
        )}

        {(action === 'transfer' || action === 'suspend') && (
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}

        {action === 'reinstate' && (
          <p className="text-sm text-muted-foreground">
            Reinstate this student to active status?
          </p>
        )}

        {action === 'delete' && (
          <p className="text-sm text-muted-foreground">
            This permanently removes the student record. This action cannot be undone.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={cfg.variant ?? 'default'}
          disabled={busy || (action === 'promote' && !sectionId)}
          onClick={run}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {cfg.confirm}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

interface HistoryProps {
  open: boolean;
  student: Student;
  onClose: () => void;
}

/** Loads and displays GET /students/:id/history in a dialog. */
export function StudentHistoryDialog({ open, student, onClose }: HistoryProps) {
  const [rows, setRows] = useState<StudentHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<StudentHistory[]>(`/students/${student.id}/history`);
        if (!cancelled) setRows(res.data ?? []);
      } catch {
        if (!cancelled) setError('Could not load history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, student.id]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title="Student history" description={student.fullName} onClose={onClose} />
      <DialogBody className="max-h-[60vh] space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No history events yet.</p>
        )}
        {!loading &&
          rows.map((h) => (
            <div key={h.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Badge>{h.eventType}</Badge>
                <span className="text-xs text-muted-foreground">{date(h.createdAt)}</span>
              </div>
              {(h.fromValue || h.toValue) && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {h.fromValue ?? '—'} <span className="text-muted-foreground">→</span> {h.toValue ?? '—'}
                </p>
              )}
              {h.note && <p className="mt-1 text-sm text-muted-foreground">{h.note}</p>}
            </div>
          ))}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
