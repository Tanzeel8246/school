import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { date, statusVariant } from '@/lib/format';
import type { Leave } from '@/lib/dto';
import { LEAVE_TYPES } from './constants';

const STATUS_FILTERS = ['', 'pending', 'approved', 'rejected'];

/** Staff leaves: filterable list with approve/reject and request actions. */
export function LeavesPanel() {
  const { can } = useAuth();
  const canManage = can('leaves:manage');
  const canRequest = can('staff:write');

  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      const res = await api.get<Leave[]>(`/staff/leaves?${qs.toString()}`);
      setRows(res.data ?? []);
    } catch {
      setError('Could not load leaves.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function review(id: string, decision: 'approve' | 'reject') {
    setBusyId(id);
    try {
      if (decision === 'approve') await api.patch(`/staff/leaves/${id}/approve`, {});
      else await api.patch(`/staff/leaves/${id}/reject`, {});
      await load();
    } catch {
      setError('Could not update leave.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Leaves</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-36">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
              </option>
            ))}
          </Select>
          {canRequest && (
            <Button size="sm" onClick={() => setRequestOpen(true)}>
              <Plus className="h-4 w-4" />
              Request
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Staff</TH>
              <TH>Type</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Days</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {loading && (
              <TR className="hover:bg-transparent">
                <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TD>
              </TR>
            )}
            {!loading && rows.length === 0 && (
              <TR className="hover:bg-transparent">
                <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                  No leave requests.
                </TD>
              </TR>
            )}
            {!loading &&
              rows.map((l) => (
                <TR key={l.id}>
                  <TD className="font-medium text-foreground">{l.staffName}</TD>
                  <TD className="capitalize">{l.leaveType}</TD>
                  <TD>{date(l.fromDate)}</TD>
                  <TD>{date(l.toDate)}</TD>
                  <TD>{l.days}</TD>
                  <TD>
                    <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                  </TD>
                  <TD className="text-right">
                    {canManage && l.status.toLowerCase() === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === l.id}
                          onClick={() => review(l.id, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === l.id}
                          onClick={() => review(l.id, 'reject')}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TD>
                </TR>
              ))}
          </TBody>
        </Table>
        </div>
      </CardContent>

      {requestOpen && (
        <RequestLeaveDialog
          onClose={() => setRequestOpen(false)}
          onDone={() => {
            setRequestOpen(false);
            load();
          }}
        />
      )}
    </Card>
  );
}

/** POST /staff/leaves — request a new leave. */
function RequestLeaveDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [staffId, setStaffId] = useState('');
  const [leaveType, setLeaveType] = useState<string>('casual');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/staff/leaves', {
        staffId,
        leaveType,
        fromDate,
        toDate,
        reason: reason || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? 'Could not submit request.' : 'Could not submit request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title="Request leave" onClose={onClose} />
      <DialogBody className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Staff ID</Label>
          <Input value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="staff-uuid" />
        </div>
        <div className="space-y-1.5">
          <Label>Leave type</Label>
          <Select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Reason (optional)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || !staffId || !fromDate || !toDate} onClick={submit}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
