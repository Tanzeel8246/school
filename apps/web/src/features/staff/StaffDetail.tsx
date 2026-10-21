import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { money, date, statusVariant } from '@/lib/format';
import type { Staff, StaffAttendance, Payslip } from '@/lib/dto';
import { ATTENDANCE_STATUSES } from './constants';

type Tab = 'attendance' | 'payroll';

interface Props {
  open: boolean;
  staff: Staff;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Staff detail dialog with Attendance and Payroll sub-sections. */
export function StaffDetail({ open, staff, onClose }: Props) {
  const { can } = useAuth();
  const canMark = can('staff_attendance:mark');
  const canPayroll = can('payroll:read');
  const [tab, setTab] = useState<Tab>('attendance');

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogHeader
        title={staff.fullName}
        description={`${staff.employeeId} · ${staff.designation || staff.staffType}`}
        onClose={onClose}
      />
      <DialogBody className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <TabButton active={tab === 'attendance'} onClick={() => setTab('attendance')}>
            Attendance
          </TabButton>
          {canPayroll && (
            <TabButton active={tab === 'payroll'} onClick={() => setTab('payroll')}>
              Payroll
            </TabButton>
          )}
        </div>

        {tab === 'attendance' && <AttendancePanel staffId={staff.id} canMark={canMark} />}
        {tab === 'payroll' && canPayroll && <PayrollPanel staff={staff} />}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** Mark today's attendance + list recent records. */
function AttendancePanel({ staffId, canMark }: { staffId: string; canMark: boolean }) {
  const [rows, setRows] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('present');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Pull a recent window (last ~30 days).
      const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const res = await api.get<StaffAttendance[]>(
        `/staff/${staffId}/attendance?from=${from}&to=${today()}`,
      );
      setRows(res.data ?? []);
    } catch {
      setError('Could not load attendance.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  async function mark() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/staff/${staffId}/attendance`, { date: today(), status });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? 'Could not save attendance.' : 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canMark && (
        <div className="flex items-end gap-3 rounded-lg border border-border p-3">
          <div className="space-y-1.5">
            <Label>Today ({date(today())})</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={mark} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Mark
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No recent attendance records.</p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{date(r.date)}</span>
              <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Show base salary + last payslip from GET /staff/:id/payroll. */
function PayrollPanel({ staff }: { staff: Staff }) {
  const [last, setLast] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Response shape is flexible: { lastPayslip } or { payslips: [] }.
        const res = await api.get<{ lastPayslip?: Payslip; payslips?: Payslip[] }>(
          `/staff/${staff.id}/payroll`,
        );
        if (cancelled) return;
        const d = res.data;
        setLast(d.lastPayslip ?? d.payslips?.[0] ?? null);
      } catch {
        if (!cancelled) setError('Could not load payroll.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staff.id]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3">
        <p className="text-xs text-muted-foreground">Base salary</p>
        <p className="text-lg font-semibold text-foreground">{money(staff.baseSalary)}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !last ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No payslips generated yet.</p>
      ) : (
        <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">Last payslip · {last.periodMonth}</span>
            <Badge variant={statusVariant(last.status)}>{last.status}</Badge>
          </div>
          <Row label="Base" value={money(last.baseSalary)} />
          <Row label="Allowances" value={money(last.allowances)} />
          <Row label="Deductions" value={money(last.deductions)} />
          <div className="border-t border-slate-100 pt-2">
            <Row label="Net salary" value={money(last.netSalary)} strong />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  );
}
